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

  findAll(search?: string) {
    const where: any = { active: true };

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

  async findOne(id: string) {
    const bank = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: { currency: true },
    });

    if (!bank) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    return bank;
  }

  async update(id: string, updateBankDto: UpdateBankAccountDto) {
    await this.findOne(id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: updateBankDto,
      include: { currency: true },
    });
  }

  async addMovement(dto: any) {
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

  async liquidatePosBatch(dto: LiquidatePosBatchDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.findUnique({
        where: { id: dto.bankAccountId },
        include: { currency: true },
      });

      if (!account) throw new NotFoundException('Cuenta no encontrada');

      const pendingAmount = Number(account.pendingLiquidation);
      if (pendingAmount <= 0)
        throw new BadRequestException('No hay fondos pendientes para liquidar');

      const settlementAmount = pendingAmount - dto.commissionAmount;
      if (settlementAmount < 0)
        throw new BadRequestException(
          'La comisión no puede ser mayor al monto pendiente',
        );

      // 0. Obtener tasa actual del dólar para el registro estático
      const companySettings = await tx.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true },
      });
      const currentExchangeRate = Number(
        companySettings?.preferredSecondaryCurrency?.exchangeRate || 1,
      );

      // 1. Crear el gasto por comisión (si la hay)
      if (dto.commissionAmount > 0) {
        await (tx as any).expense.create({
          data: {
            description: `Comisión Bancaria - Liquidación POS`,
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

      // 2. Crear el movimiento bancario por el monto NETO
      await tx.bankMovement.create({
        data: {
          bankAccountId: account.id,
          type: 'IN',
          amount: settlementAmount,
          category: 'SALE_TRANSFER',
          description: `Liquidación de Lote POS (Neto)`,
          reference: 'AUTO-POS',
        },
      });

      // 3. Actualizar balance de la cuenta
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

  async getHistory(bankAccountId: string, limit: number = 50) {
    return this.prisma.bankMovement.findMany({
      where: { bankAccountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: { active: false },
    });
  }
}
