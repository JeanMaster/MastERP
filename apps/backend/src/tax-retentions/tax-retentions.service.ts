import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxRetentionDto } from './dto/create-tax-retention.dto';

@Injectable()
export class TaxRetentionsService {
  constructor(private prisma: PrismaService) {}

  async create(createTaxRetentionDto: CreateTaxRetentionDto) {
    const { invoiceId, purchaseId, amount, ...retentionData } = createTaxRetentionDto;

    return await this.prisma.$transaction(async (prisma) => {
      // 1. Check for duplicate voucher number
      const existing = await prisma.taxRetention.findUnique({
        where: { voucherNumber: retentionData.voucherNumber },
      });
      if (existing) {
        throw new BadRequestException(`El número de comprobante ${retentionData.voucherNumber} ya existe`);
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
          throw new BadRequestException('La factura especificada no existe');
        }

        // Register a payment record of type RETENTION
        await prisma.payment.create({
          data: {
            invoiceId,
            amount,
            paymentMethod: `RETENTION_${retentionData.type}`,
            reference: retentionData.voucherNumber,
            notes: `Retención recibida - Comprobante #${retentionData.voucherNumber}`,
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
          throw new BadRequestException('La compra especificada no existe');
        }

        // Register a purchase payment record of type RETENTION
        await prisma.purchasePayment.create({
          data: {
            purchaseId,
            amount,
            paymentMethod: `RETENTION_${retentionData.type}`,
            reference: retentionData.voucherNumber,
            notes: `Retención emitida - Comprobante #${retentionData.voucherNumber}`,
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
            paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL',
          },
        });
      }

      return retention;
    });
  }

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

  async findOne(id: string) {
    return this.prisma.taxRetention.findUnique({
      where: { id },
      include: {
        invoice: { include: { client: true } },
        purchase: { include: { supplier: true } },
      },
    });
  }

  async remove(id: string) {
    // ... (keep existing code)
  }

  /**
   * Generar el archivo TXT para el SENIAT (Retenciones de IVA)
   */
  async generateSeniatTxt(startDate?: Date, endDate?: Date): Promise<string> {
    const company = await this.prisma.companySettings.findFirst();
    if (!company) {
      throw new BadRequestException('Debe configurar los datos de la empresa (RIF) antes de exportar.');
    }

    const where: any = {
      type: 'IVA',
      purchaseId: { not: null }, // Solo retenciones practicadas a proveedores
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
      throw new BadRequestException('No se encontraron retenciones en el periodo seleccionado.');
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

      const period = `${ret.voucherDate.getFullYear()}${ (ret.voucherDate.getMonth() + 1).toString().padStart(2, '0') }`;
      
      // Columnas según estándar SENIAT (TAB-delimited)
      const row = [
        cleanRif(company.rif),       // A: RIF Agente
        period,                      // B: Período (AAAAMM)
        formatDate(p.invoiceDate),    // C: Fecha Factura (DD-MM-AAAA)
        'C',                         // D: Tipo Operación (Siempre C para compras)
        '01',                        // E: Tipo Documento (01=Factura, asumiendo factura)
        cleanRif(p.supplier.rif),    // F: RIF Proveedor
        p.invoiceNumber || '',       // G: Número Documento
        p.invoiceControlNumber || '',// H: Número Control
        p.total.toFixed(2),          // I: Monto Total
        ret.baseAmount.toFixed(2),   // J: Base Imponible
        ret.amount.toFixed(2),       // K: Monto Retenido
        '0',                         // L: Documento Afectado (0 si no aplica)
        ret.voucherNumber,           // M: Número Comprobante
        '0.00',                      // N: Monto Exento (simplificado)
        '16.00',                     // O: Alícuota (ej. 16.00)
        '0',                         // P: Expediente (0 si no aplica)
      ];

      txt += row.join('\t') + '\r\n';
    }

    return txt;
  }
}
