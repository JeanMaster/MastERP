import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { MovementType } from '../cash-register/dto/create-movement.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cashRegisterService: CashRegisterService,
  ) {}

  /**
   * Records a new payment for an invoice.
   * Handles currency conversion if the payment currency differs from the invoice debt currency.
   * Updates invoice status and records a cash movement if a session is active.
   * @param createPaymentDto The payment data.
   * @returns The created payment and the updated invoice record.
   */
  async createPayment(createPaymentDto: CreatePaymentDto) {
    // Verify invoice existence
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: createPaymentDto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Verify invoice is not already fully paid
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    // Verify payment amount doesn't exceed pending balance
    const balance = Number(invoice.balance);
    if (createPaymentDto.amount > balance) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) exceeds pending balance (${balance})`,
      );
    }

    // Process payment and update invoice in a transaction
    return this.prisma.$transaction(async (tx) => {
      let amountAppliedToInvoice = createPaymentDto.amount;

      // Handle currency normalization if payment method indicates a specific currency
      if (createPaymentDto.paymentMethod.startsWith('CURRENCY_')) {
        const currencyCode = createPaymentDto.paymentMethod.replace(
          'CURRENCY_',
          '',
        );

        // If payment currency is DIFFERENT from the invoice debt currency
        if (currencyCode !== invoice.currencyCode) {
          // Debt is USD, payment is VES
          if (invoice.currencyCode !== 'VES' && currencyCode === 'VES') {
            // Convert VES to USD using the invoice historical exchange rate
            amountAppliedToInvoice =
              createPaymentDto.amount / Number(invoice.exchangeRate);
          }
          // Debt is VES, payment is USD: Assumes frontend handled the conversion or rate is 1
        }
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId: createPaymentDto.invoiceId,
          amount: createPaymentDto.amount, // Nominal amount received
          paymentMethod: createPaymentDto.paymentMethod,
          reference: createPaymentDto.reference,
          notes: createPaymentDto.notes
            ? `${createPaymentDto.notes} (Applied: ${amountAppliedToInvoice.toFixed(2)} ${invoice.currencyCode})`
            : `Applied: ${amountAppliedToInvoice.toFixed(2)} ${invoice.currencyCode}`,
        },
      });

      // Update invoice amounts
      const newPaidAmount = Number(invoice.paidAmount) + amountAppliedToInvoice;
      const newBalance = Number(invoice.total) - newPaidAmount;

      // Determine new status
      let newStatus = invoice.status;
      if (Math.abs(newBalance) < 0.01) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIAL';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: createPaymentDto.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus as any,
        },
      });

      // Record cash movement if a session is active
      try {
        const activeSession = await this.cashRegisterService.getActiveSession();
        if (activeSession) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: MovementType.SALE,
              amount: createPaymentDto.amount,
              currencyCode: createPaymentDto.paymentMethod.startsWith(
                'CURRENCY_',
              )
                ? createPaymentDto.paymentMethod.replace('CURRENCY_', '')
                : 'VES',
              description: `Payment for Invoice ${invoice.number}`,
              notes: `PaymentID: ${payment.id}`,
              performedBy: 'System',
              saleId: invoice.saleId,
            },
          });
        }
      } catch (cashError) {
        console.error(
          'Error recording cash movement for payment:',
          cashError,
        );
      }

      return { payment, invoice: updatedInvoice };
    });
  }

  /**
   * Retrieves all payments for a specific invoice.
   * @param invoiceId The ID of the invoice.
   * @returns A list of payments.
   */
  async getPaymentsByInvoice(invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Retrieves all payment records in the system.
   * @returns A list of payments with invoice and client details.
   */
  async getAllPayments() {
    return this.prisma.payment.findMany({
      include: {
        invoice: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Deletes a payment record and reverts its impact on the invoice.
   * @param id The ID of the payment to delete.
   * @returns The deleted payment record.
   */
  async removePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const invoice = payment.invoice;

    return this.prisma.$transaction(async (tx) => {
      // Recalculate applied amount for reversal
      let appliedAmount = Number(payment.amount);

      if (payment.paymentMethod.startsWith('CURRENCY_')) {
        const currencyCode = payment.paymentMethod.replace('CURRENCY_', '');
        if (currencyCode !== invoice.currencyCode) {
          if (invoice.currencyCode !== 'VES' && currencyCode === 'VES') {
            appliedAmount =
              Number(payment.amount) / Number(invoice.exchangeRate);
          }
        }
      }

      // Revert invoice amounts
      const newPaidAmount = Math.max(
        0,
        Number(invoice.paidAmount) - appliedAmount,
      );
      const newBalance = Number(invoice.total) - newPaidAmount;

      // Determine new status
      let newStatus = 'PARTIAL';
      if (newPaidAmount <= 0) {
        newStatus = 'PENDING';
      } else if (Math.abs(newBalance) < 0.01) {
        newStatus = 'PAID';
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus as any,
        },
      });

      // Delete associated cash movements
      await tx.cashMovement.deleteMany({
        where: {
          notes: { contains: `PaymentID: ${payment.id}` },
        },
      });

      // Delete the payment record
      return tx.payment.delete({
        where: { id },
      });
    });
  }
}
