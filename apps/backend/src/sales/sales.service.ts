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
                include: {
                    currency: true,
                    components: {
                        include: { componentProduct: true }
                    }
                }
            });

            if (!product) {
                throw new BadRequestException(`Producto con ID ${item.productId} no encontrado`);
            }

            // Validar stock (si aplica)
            if (product.type === 'COMPOSED') {
                // Validación para productos compuestos: check stock of all components
                for (const component of product.components) {
                    const requiredQuantity = Number(component.quantity) * Number(item.quantity);
                    if (Number(component.componentProduct.stock) < requiredQuantity) {
                        throw new BadRequestException(
                            `Stock insuficiente para componente ${component.componentProduct.name}. ` +
                            `Requerido: ${requiredQuantity}, Disponible: ${component.componentProduct.stock}`
                        );
                    }
                }
            } else if (product.type !== 'SERVICE' && Number(product.stock) > 0 && Number(product.stock) < Number(item.quantity)) {
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
                            product: {
                                include: {
                                    components: true
                                }
                            },
                        },
                    },
                    client: true,
                },
            });

            // Actualizar stock de productos
            for (const item of newSale.items) {
                if (item.product.type === 'COMPOSED') {
                    // Si es compuesto, descontar componentes
                    for (const component of item.product.components) {
                        const quantityToDecrement = Number(component.quantity) * Number(item.quantity);
                        await prisma.product.update({
                            where: { id: component.componentProductId },
                            data: {
                                stock: {
                                    decrement: quantityToDecrement,
                                },
                            },
                        });
                    }
                } else if (item.product.type !== 'SERVICE' && Number(item.product.stock) > 0) {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                decrement: Number(item.quantity),
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
                const creditInfo = this.extractCreditInfo(saleData.paymentMethod, Number(sale.total), Number(sale.exchangeRate));

                // Si es un crédito en divisa (ej: USD), el monto de la factura debe ser en esa divisa
                // para protegerse de la inflación, tal como pidió el usuario.
                const invoiceAmount = creditInfo.originalAmount || creditInfo.amount;

                // Calcular fecha de vencimiento (30 días por defecto)
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);

                await this.invoiceService.createCreditInvoice({
                    clientId: sale.clientId || '', // Si no hay cliente, se puede manejar con un cliente genérico
                    saleId: sale.id,
                    subtotal: Number(sale.subtotal),
                    discount: Number(sale.discount),
                    tax: Number(sale.tax),
                    total: invoiceAmount,
                    dueDate,
                    notes: `Factura generada automáticamente por venta a crédito - ${sale.invoiceNumber}`,
                    invoiceNumber: sale.invoiceNumber, // Use SAME number as sale
                    currencyCode: creditInfo.currencyCode,
                    exchangeRate: creditInfo.exchangeRate,
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

        // Filtro por número de factura
        if (filters.invoiceNumber) {
            where.invoiceNumber = {
                contains: filters.invoiceNumber,
                mode: 'insensitive'
            };
        }

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
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    include: { components: true }
                });

                if (product) {
                    if (product.type === 'COMPOSED') {
                        // Restaurar componentes
                        for (const component of product.components) {
                            const quantityToRestore = Number(component.quantity) * Number(item.quantity);
                            await prisma.product.update({
                                where: { id: component.componentProductId },
                                data: { stock: { increment: quantityToRestore } }
                            });
                        }
                    } else if (product.type !== 'SERVICE') {
                        await prisma.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: Number(item.quantity) } }
                        });
                    }
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
     * Helper: Extraer información detallada del crédito (monto, moneda, tasa)
     */
    private extractCreditInfo(paymentMethod: string, totalAmount: number, saleRate: number = 1): {
        amount: number, // en Bs
        currencyCode: string,
        exchangeRate: number,
        originalAmount?: number // en divisa si aplica
    } {
        const methods = paymentMethod.split(', ');

        for (const methodPart of methods) {
            if (methodPart.toUpperCase().includes('ACCOUNT_CREDIT')) {
                // Formato: ACCOUNT_CREDIT_USD:10.5:45.5 (Metodo_MONEDA:MONTO_DIVISA:TASA)
                // O simple: ACCOUNT_CREDIT:500 (Metodo:MONTO_BS)
                const mainParts = methodPart.split(':');
                const methodKey = mainParts[0]; // ACCOUNT_CREDIT o ACCOUNT_CREDIT_USD
                const isForeign = methodKey.includes('_');
                const amount = mainParts[1] ? parseFloat(mainParts[1]) : totalAmount;

                // Si es moneda extranjera y no viene tasa, usar la tasa de la venta
                const defaultRate = isForeign ? (saleRate > 1 ? saleRate : 1) : 1;
                const rate = mainParts[2] ? parseFloat(mainParts[2]) : defaultRate;

                const currencyCode = isForeign ? methodKey.split('_')[2] : 'VES';

                return {
                    amount: currencyCode === 'VES' ? amount : amount * rate,
                    currencyCode,
                    exchangeRate: rate,
                    originalAmount: currencyCode === 'VES' ? undefined : amount
                };
            }
        }

        return { amount: totalAmount, currencyCode: 'VES', exchangeRate: 1 };
    }
}