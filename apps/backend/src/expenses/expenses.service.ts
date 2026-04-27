import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new expense record.
   * If the expense is linked to a bank account, it also records a bank movement
   * and updates the account balance.
   * @param createExpenseDto The data for the new expense.
   * @returns The created expense record.
   */
  async create(createExpenseDto: CreateExpenseDto) {
    // Get current exchange rate for secondary currency if not provided or set to 1
    let exchangeRate = createExpenseDto.exchangeRate;
    if (!exchangeRate || exchangeRate === 1) {
      const companySettings = await this.prisma.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true },
      });
      if (companySettings?.preferredSecondaryCurrency?.exchangeRate) {
        exchangeRate = Number(
          companySettings.preferredSecondaryCurrency.exchangeRate,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the expense
      const expense = await tx.expense.create({
        data: {
          description: createExpenseDto.description,
          amount: createExpenseDto.amount,
          currencyCode: createExpenseDto.currencyCode,
          exchangeRate: exchangeRate || 1,
          date: createExpenseDto.date
            ? new Date(createExpenseDto.date)
            : new Date(),
          category: createExpenseDto.category,
          paymentMethod: createExpenseDto.paymentMethod,
          reference: createExpenseDto.reference,
          notes: createExpenseDto.notes,
          bankAccountId: createExpenseDto.bankAccountId,
          taxAmount: createExpenseDto.taxAmount || 0,
          isTaxable: createExpenseDto.isTaxable || false,
        },
      });

      // 2. If it's linked to a bank account, record movement and update balance
      if (createExpenseDto.bankAccountId) {
        const bankAccount = await tx.bankAccount.findUnique({
          where: { id: createExpenseDto.bankAccountId },
          include: { currency: true },
        });

        if (!bankAccount) {
          throw new NotFoundException(
            `Bank account ${createExpenseDto.bankAccountId} not found`,
          );
        }

        // Calculate amount in bank account's currency
        let amountInBankCurrency = createExpenseDto.amount;

        // If expense currency is different from bank account currency
        if (createExpenseDto.currencyCode !== bankAccount.currency.code) {
          if (bankAccount.currency.isPrimary) {
            // Bank is VES, Expense is likely USD (Secondary)
            // Or Expense is USD, Bank is VES.
            // Use the determined exchangeRate
            amountInBankCurrency =
              createExpenseDto.amount * (exchangeRate || 1);
          } else {
            // Bank is USD (Secondary), Expense is VES (Primary)
            amountInBankCurrency =
              createExpenseDto.amount / (exchangeRate || 1);
          }
        }

        // Create Bank Movement (type OUT)
        const movement = await tx.bankMovement.create({
          data: {
            bankAccountId: bankAccount.id,
            type: 'OUT',
            amount: amountInBankCurrency,
            category: 'EXPENSE',
            description: `Expense: ${createExpenseDto.description}`,
            reference:
              createExpenseDto.reference || `EXP-${expense.id.substring(0, 8)}`,
            date: expense.date,
          },
        });

        // Update Expense with movement link
        await tx.expense.update({
          where: { id: expense.id },
          data: { bankMovementId: movement.id },
        });

        // Update Bank Balance
        await tx.bankAccount.update({
          where: { id: bankAccount.id },
          data: { balance: { decrement: amountInBankCurrency } },
        });
      }

      return expense;
    });
  }

  /**
   * Retrieves all expenses, ordered by date descending.
   * @returns A list of expenses including bank account data.
   */
  async findAll() {
    return this.prisma.expense.findMany({
      include: {
        bankAccount: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Retrieves a single expense record by its ID.
   * @param id The ID of the expense.
   * @returns The expense record.
   * @throws NotFoundException if the expense is not found.
   */
  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  /**
   * Updates an existing expense record.
   * @param id The ID of the expense to update.
   * @param updateExpenseDto The updated data.
   * @returns The updated expense record.
   */
  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    await this.findOne(id); // Check existence

    return this.prisma.expense.update({
      where: { id },
      data: {
        description: updateExpenseDto.description,
        amount: updateExpenseDto.amount,
        currencyCode: updateExpenseDto.currencyCode,
        exchangeRate: updateExpenseDto.exchangeRate,
        date: updateExpenseDto.date
          ? new Date(updateExpenseDto.date)
          : undefined,
        category: updateExpenseDto.category,
        paymentMethod: updateExpenseDto.paymentMethod,
        reference: updateExpenseDto.reference,
        notes: updateExpenseDto.notes,
        taxAmount: (updateExpenseDto as any).taxAmount,
        isTaxable: (updateExpenseDto as any).isTaxable,
      },
    });
  }

  /**
   * Deletes an expense record.
   * @param id The ID of the expense to delete.
   * @returns The deleted expense record.
   */
  async remove(id: string) {
    await this.findOne(id); // Check existence
    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
