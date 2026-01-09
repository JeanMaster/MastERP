import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceService {
    constructor(private prisma: PrismaService) { }

    /**
     * Generate the next invoice number
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
                        currentNumber: 1
                    }
                });
            }

            // Generate invoice number with leading zeros (8 digits)
            const invoiceNumber = `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;

            // Increment counter for next invoice (atomic operation within transaction)
            await prisma.invoiceCounter.update({
                where: { id: counter.id },
                data: {
                    currentNumber: counter.currentNumber + 1
                }
            });

            return invoiceNumber;
        });
    }

    /**
     * Get current invoice counter
     */
    async getCurrentCounter() {
        return this.prisma.invoiceCounter.findFirst();
    }

    /**
     * Get the next invoice number without incrementing (for display purposes)
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
                        currentNumber: 1
                    }
                });
            }

            // Return the next invoice number without incrementing
            return `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;
        });
    }

    /**
     * Reset invoice counter (for testing or new fiscal year)
     */
    async resetCounter() {
        return this.prisma.invoiceCounter.updateMany({
            data: {
                currentNumber: 1
            }
        });
    }

    /**
     * Reserve an invoice number (for immediate use in sale creation)
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
                        currentNumber: 1
                    }
                });
            }

            // Generate invoice number with leading zeros (8 digits)
            const invoiceNumber = `${counter.prefix}-${counter.currentNumber.toString().padStart(8, '0')}`;

            // Increment counter for next invoice (atomic operation within transaction)
            await prisma.invoiceCounter.update({
                where: { id: counter.id },
                data: {
                    currentNumber: counter.currentNumber + 1
                }
            });

            return invoiceNumber;
        });
    }

    /**
     * Create a credit invoice
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
        invoiceNumber?: string; // Optional: specify invoice number
        currencyCode?: string;
        exchangeRate?: number;
    }) {
        // Use provided invoice number or generate a new one
        const invoiceNumber = data.invoiceNumber || await this.generateInvoiceNumber();
        const balance = data.total; // Initially, full amount is due

        const invoice = await this.prisma.invoice.create({
            data: {
                number: invoiceNumber,
                clientId: data.clientId,
                saleId: data.saleId,
                subtotal: data.subtotal,
                discount: data.discount || 0,
                tax: data.tax || 0,
                total: data.total,
                balance,
                dueDate: data.dueDate,
                notes: data.notes,
                status: 'PENDING',
                currencyCode: data.currencyCode || 'VES',
                exchangeRate: data.exchangeRate || 1,
            },
            include: {
                client: true,
            },
        });

        return invoice;
    }

    /**
     * Get invoices by client
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
     * Get all pending invoices
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
     * Get overdue invoices
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
     * Get invoice by ID
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