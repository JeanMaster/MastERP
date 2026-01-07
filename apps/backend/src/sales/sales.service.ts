import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { MovementType } from '../cash-register/dto/create-movement.dto';

@Injectable()
export class SalesService {
    constructor(
        private prisma: PrismaService,
        private invoiceService: InvoiceService,
        private cashRegisterService: CashRegisterService
    ) { }

    /**
     * Crear una nueva venta
     */
    async create(createSaleDto: CreateSaleDto) {
        const { items, invoiceNumber: reservedInvoiceNumber, ...saleData } = createSaleDto;

        // Validar productos, stock y preparar items con costo
        const itemsWithCost: any[] = [];

        for (const item of items) {
            const product = await this.prisma.product.findUnique({
                where: { id: item.productId },
                include: { currency: true }
            });

            if (!product) {
                throw new BadRequestException(`Producto con ID ${item.productId} no encontrado`);
            }

            // Validar stock (si aplica)
            if (product.type !== 'SERVICE' && product.stock > 0 && product.stock < item.quantity) {
                throw new BadRequestException(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
            }

            // Calculate cost in Primary Currency
            const rate = product.currency?.isPrimary ? 1 : Number(product.currency?.exchangeRate || 1);
            const costInPrimary = Number(product.costPrice || 0) * rate;

            itemsWithCost.push({
                ...item,
                cost: costInPrimary, // Capturar costo normalizado
            });
        }

        // Obtener sesión de caja activa (si existe)
        const activeSession = await this.cashRegisterService.getActiveSession();

        // Crear la venta con items en una transacción
        const sale = await this.prisma.$transaction(async (prisma) => {
            // Use reserved invoice number if provided, otherwise generate a new one
            let invoiceNumber = reservedInvoiceNumber;
            if (!invoiceNumber) {
                invoiceNumber = await this.invoiceService.generateInvoiceNumber();
            }

            // Crear la venta con número de factura
            const newSale = await prisma.sale.create({
                data: {
                    ...saleData,
                    invoiceNumber,
                    cashSessionId: activeSession?.id,
                    items: {
                        create: itemsWithCost,
                    },
                },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                    client: true,
                },
            });

            // Actualizar stock de productos solo si tienen stock controlado (stock > 0)
            for (const item of items) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                });

                if (product && product.type !== 'SERVICE' && product.stock > 0) {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }
            }

            return newSale;
        });

        // Registrar movimientos en caja (Fuera de la transacción de venta para no bloquear, si falla se puede manejar o ignorar)
        if (activeSession) {
            try {
                await this.registerCashMovements(activeSession.id, sale, saleData.paymentMethod);
            } catch (error) {
                console.error('Error recording cash movements for sale:', error);
                // No lanzamos error para no revertir la venta, pero logueamos el fallo
            }
        }

        // Detectar si hay crédito en el método de pago y crear factura automáticamente
        if (this.hasCredit(saleData.paymentMethod)) {
            try {
                const creditAmount = this.extractCreditAmount(saleData.paymentMethod, Number(sale.total));

                // Calcular fecha de vencimiento (30 días por defecto)
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);

                await this.invoiceService.createCreditInvoice({
                    clientId: sale.clientId || '', // Si no hay cliente, se puede manejar con un cliente genérico
                    saleId: sale.id,
                    subtotal: Number(sale.subtotal),
                    discount: Number(sale.discount),
                    tax: Number(sale.tax),
                    total: creditAmount,
                    dueDate,
                    notes: `Factura generada automáticamente por venta a crédito - ${sale.invoiceNumber}`,
                    invoiceNumber: sale.invoiceNumber, // Use SAME number as sale
                });
            } catch (error) {
                console.error('Error creating credit invoice:', error);
                // No lanzamos error para no revertir la venta
            }
        }

        return sale;
    }

    /**
     * Registrar movimientos de caja basados en el método de pago
     */
    private async registerCashMovements(sessionId: string, sale: any, paymentMethodStr: string) {
        const methods = paymentMethodStr.split(', ');

        for (const methodPart of methods) {
            let method = methodPart;
            let amount = Number(sale.total); // Por defecto todo el monto si es simple

            // Si es compuesto "METHOD:AMOUNT"
            if (methodPart.includes(':')) {
                const parts = methodPart.split(':');
                method = parts[0];
                amount = parseFloat(parts[1]);
            }

            // Identificar si es Efectivo (VES) o Divisa (USD, etc)
            if (method === 'CASH') {
                // Pago en efectivo Bs
                await this.cashRegisterService.createMovement({
                    sessionId,
                    type: MovementType.SALE,
                    amount: amount,
                    currencyCode: 'VES',
                    description: `Venta #${sale.invoiceNumber}`,
                    saleId: sale.id
                });
            } else if (method.startsWith('CURRENCY_')) {
                // Pago en Divisa Efectivo (CURRENCY_USD, CURRENCY_EUR, etc)
                // El formato esperado es CURRENCY_CODE
                const currencyCode = method.replace('CURRENCY_', '');

                await this.cashRegisterService.createMovement({
                    sessionId,
                    type: MovementType.SALE,
                    amount: amount,
                    currencyCode: currencyCode,
                    description: `Venta #${sale.invoiceNumber} (${currencyCode})`,
                    saleId: sale.id
                });
            }
            // Otros métodos (DEBIT, CREDIT, TRANSFER) no generan movimiento de caja
        }
    }

    /**
     * Listar todas las ventas
     */
    async findAll() {
        return this.prisma.sale.findMany({
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                client: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Listar ventas con filtros
     */
    async findWithFilters(filters: any) {
        const where: any = {};

        // Filtro por rango de fechas
        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) {
                where.date.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setDate(endDate.getDate() + 1);
                where.date.lt = endDate;
            }
        }

        // Filtro por cliente
        if (filters.clientId) {
            where.clientId = filters.clientId;
        }

        // Filtro por forma de pago
        if (filters.paymentMethod) {
            where.paymentMethod = {
                contains: filters.paymentMethod,
                mode: 'insensitive'
            };
        }

        // Filtro por monto
        if (filters.minAmount || filters.maxAmount) {
            where.total = {};
            if (filters.minAmount) {
                where.total.gte = filters.minAmount;
            }
            if (filters.maxAmount) {
                where.total.lte = filters.maxAmount;
            }
        }

        // Filtro por producto
        if (filters.productId) {
            where.items = {
                some: {
                    productId: filters.productId,
                },
            };
        }

        return this.prisma.sale.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                client: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Obtener las últimas compras de un cliente
     */
    async getClientRecentPurchases(clientId: string, limit: number = 5) {
        return this.prisma.sale.findMany({
            where: {
                clientId,
                active: true
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                            }
                        },
                    },
                },
            },
            orderBy: { date: 'desc' },
            take: limit,
        });
    }

    /**
     * Obtener una venta por ID
     */
    async findOne(id: string) {
        const sale = await this.prisma.sale.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                client: true,
            },
        });

        if (!sale) {
            throw new BadRequestException(`Venta con ID ${id} no encontrada`);
        }

        return sale;
    }

    /**
     * Actualizar el método de pago de una venta
     */
    async updatePaymentMethod(id: string, paymentMethod: string) {
        // Verificar que la venta existe
        const sale = await this.prisma.sale.findUnique({ where: { id } });
        if (!sale) {
            throw new BadRequestException(`Venta con ID ${id} no encontrada`);
        }

        return this.prisma.sale.update({
            where: { id },
            data: { paymentMethod }
        });
    }

    /**
     * Eliminar una venta y restaurar stock. 
     * Si es la última venta, permite retroceder el contador de facturas.
     */
    async remove(id: string) {
        const sale = await this.prisma.sale.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!sale) {
            throw new BadRequestException(`Venta con ID ${id} no encontrada`);
        }

        return await this.prisma.$transaction(async (prisma) => {
            // 1. Restaurar stock
            for (const item of sale.items) {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });
                if (product && product.type !== 'SERVICE') {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: Number(item.quantity) } }
                    });
                }
            }

            // 2. Eliminar movimientos de caja asociados
            await prisma.cashMovement.deleteMany({ where: { saleId: id } });

            // 3. Eliminar factura a crédito si existe
            await prisma.invoice.deleteMany({ where: { saleId: id } });

            // 4. Verificar si es la última factura para retroceder el contador
            const latestSale = await prisma.sale.findFirst({
                orderBy: { createdAt: 'desc' }
            });

            if (latestSale && latestSale.id === id) {
                const counter = await prisma.invoiceCounter.findFirst();
                if (counter && counter.currentNumber > 1) {
                    await prisma.invoiceCounter.update({
                        where: { id: counter.id },
                        data: { currentNumber: { decrement: 1 } }
                    });
                }
            }

            // 5. Eliminar items y venta
            await prisma.saleItem.deleteMany({ where: { saleId: id } });
            return prisma.sale.delete({ where: { id } });
        });
    }


    /**
     * Helper: Detectar si el método de pago incluye crédito
     */
    private hasCredit(paymentMethod: string): boolean {
        return paymentMethod.toUpperCase().includes('ACCOUNT_CREDIT');
    }

    /**
     * Helper: Extraer el monto a crédito del método de pago
     */
    private extractCreditAmount(paymentMethod: string, totalAmount: number): number {
        const methods = paymentMethod.split(', ');

        for (const methodPart of methods) {
            if (methodPart.toUpperCase().includes('ACCOUNT_CREDIT')) {
                // Si tiene formato "ACCOUNT_CREDIT:500", extraer el monto
                if (methodPart.includes(':')) {
                    const parts = methodPart.split(':');
                    return parseFloat(parts[1]);
                }
                // Si solo dice "ACCOUNT_CREDIT", asumir que es el total
                return totalAmount;
            }
        }

        return totalAmount;
    }
}