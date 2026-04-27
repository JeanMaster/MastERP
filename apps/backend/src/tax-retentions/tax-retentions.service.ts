import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxRetentionDto } from './dto/create-tax-retention.dto';

@Injectable()
export class TaxRetentionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new tax retention record (IVA or ISLR).
   * Automatically updates the associated invoice (client) or purchase (supplier) balance
   * and records a corresponding payment/purchase-payment record.
   * @param createTaxRetentionDto The retention data.
   * @returns The created tax retention record.
   */
  async create(createTaxRetentionDto: CreateTaxRetentionDto) {
    const { invoiceId, purchaseId, amount, ...retentionData } = createTaxRetentionDto;

    return this.prisma.$transaction(async (prisma) => {
      // 1. Check for duplicate voucher number
      const existing = await prisma.taxRetention.findUnique({
        where: { voucherNumber: retentionData.voucherNumber },
      });
      if (existing) {
        throw new BadRequestException(`Voucher number ${retentionData.voucherNumber} already exists`);
      }

      // 2. Create the retention record
      const retention = await prisma.taxRetention.create({
        data: {
          ...retentionData,
          amount,
          invoiceId,
          purchaseId,
        },
      });

      // 3. Handle Invoice (Client retention)
      if (invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (!invoice) {
          throw new BadRequestException('The specified invoice does not exist');
        }

        // Register a payment record of type RETENTION
        await prisma.payment.create({
          data: {
            invoiceId,
            amount,
            paymentMethod: `RETENTION_${retentionData.type}`,
            reference: retentionData.voucherNumber,
            notes: `Retention received - Voucher #${retentionData.voucherNumber}`,
          },
        });

        // Update invoice balance and status
        const newBalance = Number(invoice.balance) - Number(amount);
        const newPaidAmount = Number(invoice.paidAmount) + Number(amount);
        
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            balance: newBalance,
            paidAmount: newPaidAmount,
            status: newBalance <= 0 ? 'PAID' : 'PARTIAL',
          },
        });
      }

      // 4. Handle Purchase (Supplier retention)
      if (purchaseId) {
        const purchase = await prisma.purchase.findUnique({
          where: { id: purchaseId },
        });

        if (!purchase) {
          throw new BadRequestException('The specified purchase does not exist');
        }

        // Register a purchase payment record of type RETENTION
        await prisma.purchasePayment.create({
          data: {
            purchaseId,
            amount,
            paymentMethod: `RETENTION_${retentionData.type}`,
            reference: retentionData.voucherNumber,
            notes: `Retention issued - Voucher #${retentionData.voucherNumber}`,
          },
        });

        // Update purchase balance and payment status
        const newBalance = Number(purchase.balance) - Number(amount);
        const newPaidAmount = Number(purchase.paidAmount) + Number(amount);

        await prisma.purchase.update({
          where: { id: purchaseId },
          data: {
            balance: newBalance,
            paidAmount: newPaidAmount,
            paymentStatus: (newBalance <= 0 ? 'PAID' : 'PARTIAL') as any,
          },
        });
      }

      return retention;
    });
  }

  /**
   * Retrieves all tax retention records.
   */
  async findAll() {
    return this.prisma.taxRetention.findMany({
      include: {
        invoice: {
          include: { client: true },
        },
        purchase: {
          include: { supplier: true },
        },
      },
      orderBy: { voucherDate: 'desc' },
    });
  }

  /**
   * Retrieves a single tax retention record by its ID.
   */
  async findOne(id: string) {
    return this.prisma.taxRetention.findUnique({
      where: { id },
      include: {
        invoice: { include: { client: true } },
        purchase: { include: { supplier: true } },
      },
    });
  }

  /**
   * Deletes a tax retention record and reverts its impact on the associated invoice or purchase.
   */
  async remove(id: string) {
    const retention = await this.prisma.taxRetention.findUnique({
      where: { id },
    });

    if (!retention) {
      throw new BadRequestException('Retention record not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      // 1. Revert Invoice Impact
      if (retention.invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: retention.invoiceId },
        });

        if (invoice) {
          const newBalance = Number(invoice.balance) + Number(retention.amount);
          const newPaidAmount = Number(invoice.paidAmount) - Number(retention.amount);

          await prisma.invoice.update({
            where: { id: retention.invoiceId },
            data: {
              balance: newBalance,
              paidAmount: Math.max(0, newPaidAmount),
              status: (newPaidAmount <= 0 ? 'PENDING' : 'PARTIAL') as any,
            },
          });

          // Delete associated payment record
          await prisma.payment.deleteMany({
            where: {
              invoiceId: retention.invoiceId,
              reference: retention.voucherNumber,
              paymentMethod: { startsWith: 'RETENTION_' },
            },
          });
        }
      }

      // 2. Revert Purchase Impact
      if (retention.purchaseId) {
        const purchase = await prisma.purchase.findUnique({
          where: { id: retention.purchaseId },
        });

        if (purchase) {
          const newBalance = Number(purchase.balance) + Number(retention.amount);
          const newPaidAmount = Number(purchase.paidAmount) - Number(retention.amount);

          await prisma.purchase.update({
            where: { id: retention.purchaseId },
            data: {
              balance: newBalance,
              paidAmount: Math.max(0, newPaidAmount),
              paymentStatus: (newPaidAmount <= 0 ? 'PENDING' : 'PARTIAL') as any,
            },
          });

          // Delete associated purchase payment record
          await prisma.purchasePayment.deleteMany({
            where: {
              purchaseId: retention.purchaseId,
              reference: retention.voucherNumber,
              paymentMethod: { startsWith: 'RETENTION_' },
            },
          });
        }
      }

      // 3. Delete the retention record
      return prisma.taxRetention.delete({
        where: { id },
      });
    });
  }

  /**
   * Generates a TXT file for SENIAT (Venezuelan Tax Authority) compliance (IVA retentions).
   */
  async generateSeniatTxt(startDate?: Date, endDate?: Date): Promise<string> {
    const company = await this.prisma.companySettings.findFirst();
    if (!company) {
      throw new BadRequestException('Company settings (RIF) must be configured before exporting.');
    }

    const where: any = {
      type: 'IVA',
      purchaseId: { not: null }, // Only retentions practiced to suppliers
    };

    if (startDate || endDate) {
      where.voucherDate = {};
      if (startDate) where.voucherDate.gte = startDate;
      if (endDate) where.voucherDate.lte = endDate;
    }

    const retentions = await this.prisma.taxRetention.findMany({
      where,
      include: {
        purchase: {
          include: { supplier: true },
        },
      },
      orderBy: { voucherDate: 'asc' },
    });

    if (retentions.length === 0) {
      throw new BadRequestException('No retentions found in the selected period.');
    }

    const cleanRif = (rif: string) => rif.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const formatDate = (date: Date) => {
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
    };

    let txt = '';

    for (const ret of retentions) {
      const p = ret.purchase;
      if (!p) continue;

      const period = `${ret.voucherDate.getFullYear()}${(ret.voucherDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const row = [
        cleanRif(company.rif),
        period,
        formatDate(p.invoiceDate),
        'C',
        '01',
        cleanRif(p.supplier.rif),
        p.invoiceNumber || '',
        p.invoiceControlNumber || '',
        p.total.toFixed(2),
        ret.baseAmount.toFixed(2),
        ret.amount.toFixed(2),
        '0',
        ret.voucherNumber,
        '0.00',
        '16.00',
        '0',
      ];

      txt += row.join('\t') + '\r\n';
    }

    return txt;
  }
}
