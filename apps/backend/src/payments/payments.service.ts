import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Prisma } from '@prisma/client';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { MovementType } from '../cash-register/dto/create-movement.dto';

@Injectable()
export class PaymentsService {
    constructor(
        private prisma: PrismaService,
        private cashRegisterService: CashRegisterService
    ) { }

    async createPayment(createPaymentDto: CreatePaymentDto) {
        // Verificar que la factura existe
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: createPaymentDto.invoiceId },
        });

        if (!invoice) {
            throw new NotFoundException('Factura no encontrada');
        }

        // Verificar que la factura no esté completamente pagada
        if (invoice.status === 'PAID') {
            throw new BadRequestException('La factura ya está completamente pagada');
        }

        // Verificar que el monto de pago no exceda el balance pendiente
        const balance = Number(invoice.balance);
        if (createPaymentDto.amount > balance) {
            throw new BadRequestException(
                `El monto del pago (${createPaymentDto.amount}) excede el balance pendiente (${balance})`
            );
        }

        // Crear el pago y actualizar la factura en una transacción
        const result = await this.prisma.$transaction(async (tx) => {
            let amountAppliedToInvoice = createPaymentDto.amount;

            // CASO: La factura está en USD pero se intenta pagar en Bs
            // O viceversa. Necesitamos normalizar el pago a la moneda de la factura.
            // Por ahora, asumimos que createPaymentDto.amount es lo que el usuario ingresó.
            // Pero si el método indica otra moneda, debemos convertir.
            if (createPaymentDto.paymentMethod.startsWith('CURRENCY_')) {
                const currencyCode = createPaymentDto.paymentMethod.replace('CURRENCY_', '');

                // Si la moneda del pago es DISTINTA a la moneda de la deuda de la factura
                if (currencyCode !== invoice.currencyCode) {
                    // Si la deuda es en USD y se paga en VES
                    if (invoice.currencyCode !== 'VES' && currencyCode === 'VES') {
                        // Convertir Bs a USD usando la tasa de la factura (tasa congelada al momento de la venta)
                        amountAppliedToInvoice = createPaymentDto.amount / Number(invoice.exchangeRate);
                    }
                    // Si la deuda es en VES y se paga en USD
                    else if (invoice.currencyCode === 'VES' && currencyCode !== 'VES') {
                        // Obtenemos la tasa actual (en este punto simplificamos y usamos la del pago si estuviera)
                        // Para este ajuste, asumiremos que el frontend mandó el monto YA CONVERTIDO si es necesario,
                        // o manejaremos la conversión aquí si tenemos la tasa.
                        // El usuario quiere evitar la inflación, así que la deuda en USD es lo principal.
                    }
                }
            }

            // Crear el pago
            const payment = await tx.payment.create({
                data: {
                    invoiceId: createPaymentDto.invoiceId,
                    amount: createPaymentDto.amount, // Monto nominal recibido
                    paymentMethod: createPaymentDto.paymentMethod,
                    reference: createPaymentDto.reference,
                    notes: createPaymentDto.notes ? `${createPaymentDto.notes} (Aplicado: ${amountAppliedToInvoice.toFixed(2)} ${invoice.currencyCode})` : `Aplicado: ${amountAppliedToInvoice.toFixed(2)} ${invoice.currencyCode}`,
                },
            });

            // Actualizar montos de la factura
            const newPaidAmount = Number(invoice.paidAmount) + amountAppliedToInvoice;
            const newBalance = Number(invoice.total) - newPaidAmount;

            // Determinar nuevo estado (usando pequeña tolerancia para decimales)
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
                    status: newStatus,
                },
            });

            // Registrar movimiento de caja (si hay sesión activa)
            try {
                const activeSession = await this.cashRegisterService.getActiveSession();
                if (activeSession) {
                    await tx.cashMovement.create({
                        data: {
                            sessionId: activeSession.id,
                            type: MovementType.SALE,
                            amount: createPaymentDto.amount,
                            currencyCode: createPaymentDto.paymentMethod.startsWith('CURRENCY_')
                                ? createPaymentDto.paymentMethod.replace('CURRENCY_', '')
                                : 'VES',
                            description: `Pago Factura ${invoice.number}`,
                            notes: `PaymentID: ${payment.id}`,
                            performedBy: 'Sistema',
                            saleId: invoice.saleId
                        }
                    });
                }
            } catch (cashError) {
                console.error('Error al registrar movimiento de caja para el pago:', cashError);
            }

            return { payment, invoice: updatedInvoice };
        });

        return result;
    }

    async getPaymentsByInvoice(invoiceId: string) {
        const payments = await this.prisma.payment.findMany({
            where: { invoiceId },
            orderBy: { paymentDate: 'desc' },
        });

        return payments;
    }

    async getAllPayments() {
        const payments = await this.prisma.payment.findMany({
            include: {
                invoice: {
                    include: {
                        client: true,
                    },
                },
            },
            orderBy: { paymentDate: 'desc' },
        });

        return payments;
    }

    async removePayment(id: string) {
        // Encontrar el pago y la factura asociada
        const payment = await this.prisma.payment.findUnique({
            where: { id },
            include: { invoice: true },
        });

        if (!payment) {
            throw new NotFoundException('Pago no encontrado');
        }

        const invoice = payment.invoice;

        return await this.prisma.$transaction(async (tx) => {
            // Re-calcular cuánto se aplicó realmente a la factura
            // (Usamos la misma lógica que createPayment para ser consistentes)
            let appliedAmount = Number(payment.amount);

            if (payment.paymentMethod.startsWith('CURRENCY_')) {
                const currencyCode = payment.paymentMethod.replace('CURRENCY_', '');
                if (currencyCode !== invoice.currencyCode) {
                    if (invoice.currencyCode !== 'VES' && currencyCode === 'VES') {
                        appliedAmount = Number(payment.amount) / Number(invoice.exchangeRate);
                    }
                }
            }

            // Actualizar montos de la factura
            const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - appliedAmount);
            const newBalance = Number(invoice.total) - newPaidAmount;

            // Determinar nuevo estado
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
                    status: newStatus,
                },
            });

            // Eliminar movimientos de caja asociados
            await tx.cashMovement.deleteMany({
                where: {
                    notes: { contains: `PaymentID: ${payment.id}` }
                }
            });

            // Finalmente eliminar el pago
            return await tx.payment.delete({
                where: { id },
            });
        });
    }
}
