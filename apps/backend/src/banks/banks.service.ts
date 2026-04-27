import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { LiquidatePosBatchDto } from './dto/liquidate-pos-batch.dto';

@Injectable()
export class BanksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new bank account.
   * @param createBankDto The data for the new bank account.
   * @returns The created bank account including currency data.
   */
  async create(createBankDto: CreateBankAccountDto) {
    const { initialBalance, ...data } = createBankDto;

    return this.prisma.bankAccount.create({
      data: {
        ...data,
        balance: initialBalance || 0,
      },
      include: {
        currency: true,
      },
    });
  }

  /**
   * Retrieves all active bank accounts with an optional search term.
   * @param search Search term (bank name, holder name, or account number).
   * @returns A list of bank accounts including currency data.
   */
  findAll(search?: string) {
    const where: { active: boolean; OR?: any[] } = { active: true };

    if (search) {
      where.OR = [
        { bankName: { contains: search, mode: 'insensitive' } },
        { holderName: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.bankAccount.findMany({
      where,
      include: {
        currency: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single bank account by its ID.
   * @param id The ID of the bank account.
   * @returns The bank account record including currency data.
   * @throws NotFoundException if the account is not found.
   */
  async findOne(id: string) {
    const bank = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: { currency: true },
    });

    if (!bank) {
      throw new NotFoundException(`Bank account with ID ${id} not found`);
    }

    return bank;
  }

  /**
   * Updates an existing bank account's information.
   * @param id The ID of the bank account to update.
   * @param updateBankDto The updated data.
   * @returns The updated bank account record.
   */
  async update(id: string, updateBankDto: UpdateBankAccountDto) {
    await this.findOne(id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: updateBankDto,
      include: { currency: true },
    });
  }

  /**
   * Records a new bank movement and updates the account balance.
   * Uses a transaction to ensure data integrity.
   * @param dto The data for the movement.
   * @returns The created bank movement.
   */
  async addMovement(dto: {
    bankAccountId: string;
    type: 'IN' | 'OUT';
    amount: number;
    category: string;
    description: string;
    reference?: string;
    cashSessionId?: string;
  }) {
    const {
      bankAccountId,
      type,
      amount,
      category,
      description,
      reference,
      cashSessionId,
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the movement
      const movement = await tx.bankMovement.create({
        data: {
          bankAccountId,
          type,
          amount,
          category,
          description,
          reference,
          cashSessionId,
        },
      });

      // 2. Update the account balance
      const adjustment = type === 'IN' ? Number(amount) : -Number(amount);

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          balance: { increment: adjustment },
        },
      });

      return movement;
    });
  }

  /**
   * Liquidates a POS batch, transferring pending funds to the bank account net of commissions.
   * Records a commission expense if applicable.
   * @param dto The liquidation data.
   * @param userId The ID of the user performing the liquidation.
   * @returns The result of the liquidation.
   */
  async liquidatePosBatch(dto: LiquidatePosBatchDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.findUnique({
        where: { id: dto.bankAccountId },
        include: { currency: true },
      });

      if (!account) throw new NotFoundException('Account not found');

      const pendingAmount = Number(account.pendingLiquidation);
      if (pendingAmount <= 0)
        throw new BadRequestException('No pending funds to liquidate');

      const settlementAmount = pendingAmount - dto.commissionAmount;
      if (settlementAmount < 0)
        throw new BadRequestException(
          'Commission cannot be greater than the pending amount',
        );

      // 0. Get current exchange rate for static record
      const companySettings = await tx.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true },
      });
      const currentExchangeRate = Number(
        companySettings?.preferredSecondaryCurrency?.exchangeRate || 1,
      );

      // 1. Create banking commission expense if applicable
      if (dto.commissionAmount > 0) {
        await (tx as any).expense.create({
          data: {
            description: `Bank Commission - POS Liquidation`,
            amount: dto.commissionAmount,
            currencyCode: account.currency.code,
            exchangeRate: currentExchangeRate,
            category: 'SERVICIOS',
            paymentMethod: 'TRANSFER',
            notes: dto.notes,
            userId,
          },
        });
      }

      // 2. Create bank movement for NET amount
      await tx.bankMovement.create({
        data: {
          bankAccountId: account.id,
          type: 'IN',
          amount: settlementAmount,
          category: 'SALE_TRANSFER',
          description: `POS Batch Liquidation (Net)`,
          reference: 'AUTO-POS',
        },
      });

      // 3. Update the bank account balance
      await tx.bankAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: settlementAmount },
          pendingLiquidation: 0,
        },
      });

      return {
        success: true,
        netAmount: settlementAmount,
        commission: dto.commissionAmount,
      };
    });
  }

  /**
   * Retrieves the movement history for a specific bank account.
   * @param bankAccountId The ID of the bank account.
   * @param limit Maximum number of movements to retrieve.
   * @returns A list of bank movements.
   */
  async getHistory(bankAccountId: string, limit: number = 50) {
    return this.prisma.bankMovement.findMany({
      where: { bankAccountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Performs a soft delete by marking the bank account as inactive.
   * @param id The ID of the bank account to deactivate.
   * @returns The updated bank account record.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: { active: false },
    });
  }
}
