import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates the next sequential control number (e.g., 00-00000001).
   * Uses a transaction to ensure atomicity.
   * @returns The generated control number.
   */
  async generateControlNumber(): Promise<string> {
    return await this.prisma.$transaction(async (prisma) => {
      let counter = await prisma.saleControlCounter.findFirst();

      if (!counter) {
        counter = await prisma.saleControlCounter.create({
          data: {
            prefix: '00',
            currentNumber: 1,
          },
        });
      }

      const controlNumber = `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;

      await prisma.saleControlCounter.update({
        where: { id: counter.id },
        data: { currentNumber: counter.currentNumber + 1 },
      });

      return controlNumber;
    });
  }

  /**
   * Generates the next sequential invoice number.
   * Uses a transaction to prevent race conditions.
   * @returns The generated invoice number.
   */
  async generateInvoiceNumber(): Promise<string> {
    // Use transaction to prevent race conditions with concurrent requests
    return await this.prisma.$transaction(async (prisma) => {
      // Find or create the invoice counter
      let counter = await prisma.invoiceCounter.findFirst();

      if (!counter) {
        // Create initial counter
        counter = await prisma.invoiceCounter.create({
          data: {
            prefix: 'FAC',
            currentNumber: 1,
          },
        });
      }

      // Generate invoice number with leading zeros (8 digits)
      const invoiceNumber = `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;

      // Increment counter for next invoice (atomic operation within transaction)
      await prisma.invoiceCounter.update({
        where: { id: counter.id },
        data: {
          currentNumber: counter.currentNumber + 1,
        },
      });

      return invoiceNumber;
    });
  }

  /**
   * Retrieves the current status of the invoice counter.
   * @returns The invoice counter record.
   */
  async getCurrentCounter() {
    return this.prisma.invoiceCounter.findFirst();
  }

  /**
   * Retrieves the next invoice number for display purposes without incrementing the counter.
   * @returns The next invoice number.
   */
  async getNextInvoiceNumber(): Promise<string> {
    return await this.prisma.$transaction(async (prisma) => {
      // Find or create the invoice counter
      let counter = await prisma.invoiceCounter.findFirst();

      if (!counter) {
        // Create initial counter
        counter = await prisma.invoiceCounter.create({
          data: {
            prefix: 'FAC',
            currentNumber: 1,
          },
        });
      }

      // Return the next invoice number without incrementing
      return `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;
    });
  }

  /**
   * Resets the invoice counter to 1.
   * @returns The result of the update operation.
   */
  async resetCounter() {
    return this.prisma.invoiceCounter.updateMany({
      data: {
        currentNumber: 1,
      },
    });
  }

  /**
   * Reserves an invoice number for immediate use and increments the counter.
   * @returns The reserved invoice number.
   */
  async reserveInvoiceNumber(): Promise<string> {
    return await this.prisma.$transaction(async (prisma) => {
      // Find or create the invoice counter
      let counter = await prisma.invoiceCounter.findFirst();

      if (!counter) {
        // Create initial counter
        counter = await prisma.invoiceCounter.create({
          data: {
            prefix: 'FAC',
            currentNumber: 1,
          },
        });
      }

      // Generate invoice number with leading zeros (8 digits)
      const invoiceNumber = `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;

      // Increment counter for next invoice (atomic operation within transaction)
      await prisma.invoiceCounter.update({
        where: { id: counter.id },
        data: {
          currentNumber: counter.currentNumber + 1,
        },
      });

      return invoiceNumber;
    });
  }

  /**
   * Creates a new invoice record.
   * @param data The invoice data.
   * @returns The created invoice including client data.
   */
  async create(data: {
    clientId: string;
    saleId?: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    dueDate?: Date;
    notes?: string;
    invoiceNumber?: string;
    currencyCode?: string;
    exchangeRate?: number;
    status?: string;
    paidAmount?: number;
    balance?: number;
  }) {
    const invoiceNumber = data.invoiceNumber || (await this.generateInvoiceNumber());
    const status = data.status || 'PENDING';
    const paidAmount = data.paidAmount || 0;
    const balance = data.balance !== undefined ? data.balance : (data.total - paidAmount);

    return this.prisma.invoice.create({
      data: {
        number: invoiceNumber,
        clientId: data.clientId,
        saleId: data.saleId,
        subtotal: data.subtotal,
        discount: data.discount || 0,
        tax: data.tax || 0,
        total: data.total,
        balance,
        paidAmount,
        dueDate: data.dueDate,
        notes: data.notes,
        status,
        currencyCode: data.currencyCode || 'VES',
        exchangeRate: data.exchangeRate || 1,
      },
      include: {
        client: true,
      },
    });
  }

  /**
   * Creates a credit invoice.
   * Maintained for backward compatibility.
   * @param data The invoice data.
   * @returns The created invoice.
   */
  async createCreditInvoice(data: {
    clientId: string;
    saleId?: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    dueDate?: Date;
    notes?: string;
    invoiceNumber?: string;
    currencyCode?: string;
    exchangeRate?: number;
  }) {
    return this.create({
      ...data,
      status: 'PENDING',
      paidAmount: 0,
      balance: data.total,
    });
  }

  /**
   * Retrieves all invoices for a specific client.
   * @param clientId The ID of the client.
   * @returns A list of invoices including their payments.
   */
  async getClientInvoices(clientId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        clientId,
        active: true,
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices;
  }

  /**
   * Retrieves all pending and partially paid invoices.
   * @returns A list of pending invoices including client and payment data.
   */
  async getPendingInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        active: true,
      },
      include: {
        client: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return invoices;
  }

  /**
   * Retrieves all overdue invoices (pending/partial and past due date).
   * Automatically updates status to OVERDUE for found invoices.
   * @returns A list of overdue invoices.
   */
  async getOverdueInvoices() {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: now },
        active: true,
      },
      include: {
        client: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Update status to OVERDUE if needed
    for (const invoice of invoices) {
      if (invoice.status !== 'OVERDUE') {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        });
      }
    }

    return invoices;
  }

  /**
   * Retrieves a single invoice by its ID.
   * @param id The ID of the invoice.
   * @returns The invoice record including client and payment data.
   */
  async getInvoiceById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
  }
}
