import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto, ReturnType, ProductCondition } from './dto/create-return.dto';
import { UpdateReturnDto, ReturnStatus } from './dto/update-return.dto';

@Injectable()
export class ReturnsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Generar número de Nota de Crédito
     */
    private async generateCreditNoteNumber(): Promise<string> {
        const lastReturn = await this.prisma.return.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { creditNoteNumber: true }
        });

        if (!lastReturn) {
            return 'NC-00000001';
        }

        const lastNumber = parseInt(lastReturn.creditNoteNumber.split('-')[1]);
        const nextNumber = lastNumber + 1;
        return `NC-${nextNumber.toString().padStart(8, '0')}`;
    }

    /**
     * Validar elegibilidad de devolución
     */
    async validateReturnEligibility(saleId: string, items: any[]): Promise<{ eligible: boolean; message?: string }> {
        // Obtener la venta original
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!sale) {
            return { eligible: false, message: 'Venta no encontrada' };
        }

        if (!sale.active || sale.isCancelled) {
            return { eligible: false, message: 'Venta no activa o cancelada' };
        }

        // NUEVA VALIDACIÓN: Verificar si ya existe una devolución para esta factura
        const existingReturns = await this.prisma.return.findMany({
            where: {
                originalSaleId: saleId,
                status: {
                    in: ['PENDING', 'APPROVED', 'COMPLETED']
                }
            },
            include: {
                items: true
            }
        });

        if (existingReturns.length > 0) {
            // Verificar si hay una devolución pendiente o aprobada
            const pendingOrApproved = existingReturns.find(r => r.status === 'PENDING' || r.status === 'APPROVED');
            if (pendingOrApproved) {
                return {
                    eligible: false,
                    message: `Ya existe una devolución ${pendingOrApproved.status === 'PENDING' ? 'pendiente' : 'aprobada'} para esta factura (${pendingOrApproved.creditNoteNumber})`
                };
            }
        }

        // Verificar cada producto
        for (const returnItem of items) {
            const saleItem = sale.items.find(i => i.productId === returnItem.productId);

            if (!saleItem) {
                return { eligible: false, message: `Producto ${returnItem.productId} no está en la venta` };
            }

            // Verificar si el producto es retornable
            if (!saleItem.product.isReturnable) {
                return {
                    eligible: false,
                    message: `Producto ${saleItem.product.name} no es retornable`
                };
            }

            // Verificar plazo de devolución
            const deadlineDays = saleItem.product.returnDeadlineDays || 30;
            const saleDate = new Date(sale.date);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff > deadlineDays) {
                return {
                    eligible: false,
                    message: `Plazo de devolución expirado (${deadlineDays} días)`
                };
            }

            // Verificar cantidad (considerar devoluciones previas)
            const previousReturns = await this.prisma.returnItem.findMany({
                where: {
                    productId: returnItem.productId,
                    return: {
                        originalSaleId: saleId,
                        status: { in: ['APPROVED', 'COMPLETED'] }
                    }
                }
            });

            const totalReturned = previousReturns.reduce((sum, item) => sum + Number(item.quantity), 0);
            const availableToReturn = Number(saleItem.quantity) - totalReturned;

            if (returnItem.quantity > availableToReturn) {
                return {
                    eligible: false,
                    message: `Cantidad excede lo disponible para ${saleItem.product.name}. Disponible: ${availableToReturn}`
                };
            }

            if (availableToReturn === 0) {
                return {
                    eligible: false,
                    message: `El producto ${saleItem.product.name} ya fue devuelto completamente`
                };
            }
        }

        return { eligible: true };
    }

    /**
     * Crear devolución
     */
    async create(createReturnDto: CreateReturnDto) {
        // Validar elegibilidad
        const validation = await this.validateReturnEligibility(
            createReturnDto.originalSaleId,
            createReturnDto.items
        );

        if (!validation.eligible) {
            throw new BadRequestException(validation.message);
        }

        // Generar número de NC
        const creditNoteNumber = await this.generateCreditNoteNumber();

        // Crear la devolución
        const returnRecord = await this.prisma.return.create({
            data: {
                originalSaleId: createReturnDto.originalSaleId,
                creditNoteNumber,
                returnType: createReturnDto.returnType,
                reason: createReturnDto.reason,
                productCondition: createReturnDto.productCondition,
                refundAmount: createReturnDto.refundAmount,
                refundMethod: createReturnDto.refundMethod,
                notes: createReturnDto.notes,
                requestedBy: createReturnDto.requestedBy,
                items: {
                    create: createReturnDto.items
                },
                replacementItems: createReturnDto.replacementItems ? {
                    create: createReturnDto.replacementItems
                } : undefined
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                originalSale: true
            }
        });

        // Marcar la venta como con devoluciones
        await this.prisma.sale.update({
            where: { id: createReturnDto.originalSaleId },
            data: { hasReturns: true }
        });

        return returnRecord;
    }

    /**
     * Aprobar devolución
     */
    async approve(id: string, approvedBy: string) {
        const returnRecord = await this.prisma.return.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!returnRecord) {
            throw new NotFoundException('Devolución no encontrada');
        }

        if (returnRecord.status !== 'PENDING') {
            throw new BadRequestException('Solo se pueden aprobar devoluciones pendientes');
        }

        return this.prisma.return.update({
            where: { id },
            data: {
                status: ReturnStatus.APPROVED,
                approvedBy,
                approvedAt: new Date()
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                originalSale: true
            }
        });
    }

    /**
     * Rechazar devolución
     */
    async reject(id: string, reason: string) {
        const returnRecord = await this.prisma.return.findUnique({
            where: { id }
        });

        if (!returnRecord) {
            throw new NotFoundException('Devolución no encontrada');
        }

        if (returnRecord.status !== 'PENDING') {
            throw new BadRequestException('Solo se pueden rechazar devoluciones pendientes');
        }

        return this.prisma.return.update({
            where: { id },
            data: {
                status: ReturnStatus.REJECTED,
                notes: `${returnRecord.notes || ''}\n[RECHAZADO]: ${reason}`
            }
        });
    }

    /**
     * Procesar devolución (ejecutar ajustes de stock y estado)
     */
    async process(id: string) {
        const returnRecord = await this.prisma.return.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!returnRecord) {
            throw new NotFoundException('Devolución no encontrada');
        }

        if (returnRecord.status !== ReturnStatus.APPROVED) {
            throw new BadRequestException('Solo se pueden procesar devoluciones aprobadas');
        }

        // Razones donde el producto vuelve al stock (producto en buen estado)
        const restorableReasons = ['ERROR', 'UNSATISFIED', 'OTHER'];
        const shouldRestoreStock = restorableReasons.includes(returnRecord.reason);

        await this.prisma.$transaction(async (prisma) => {
            // Restore stock for each item returned ONLY if product is sellable
            for (const item of returnRecord.items) {
                if (item.product.type !== 'SERVICE') {
                    // Only increment stock if the product is not defective/expired
                    if (shouldRestoreStock) {
                        await prisma.product.update({
                            where: { id: item.productId },
                            data: {
                                stock: {
                                    increment: Number(item.quantity),
                                },
                            },
                        });
                    }

                    // If it's a SAME item exchange, decrement stock for the replacement
                    // (always decrement because we're giving a new product)
                    if (returnRecord.returnType === 'EXCHANGE_SAME') {
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
            }

            // Restore stock for replacement items in EXCHANGE_DIFFERENT
            if (returnRecord.returnType === 'EXCHANGE_DIFFERENT') {
                const returnWithReplacements = await prisma.return.findUnique({
                    where: { id },
                    include: { replacementItems: { include: { product: true } } }
                });

                if (returnWithReplacements?.replacementItems) {
                    for (const replItem of returnWithReplacements.replacementItems) {
                        if (replItem.product.type !== 'SERVICE') {
                            await prisma.product.update({
                                where: { id: replItem.productId },
                                data: {
                                    stock: {
                                        decrement: Number(replItem.quantity),
                                    },
                                },
                            });
                        }
                    }
                }
            }

            // Actualizar estado de la devolución
            await prisma.return.update({
                where: { id },
                data: {
                    status: ReturnStatus.COMPLETED
                }
            });
        });

        return this.findOne(id);
    }

    /**
     * Listar devoluciones
     */
    async findAll(filters?: any) {
        const where: any = {};

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.returnType) {
            where.returnType = filters.returnType;
        }

        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setDate(endDate.getDate() + 1);
                where.createdAt.lt = endDate;
            }
        }

        return this.prisma.return.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                originalSale: {
                    include: {
                        client: true
                    }
                },
                newSale: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Obtener una devolución por ID
     */
    async findOne(id: string) {
        const returnRecord = await this.prisma.return.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                originalSale: {
                    include: {
                        client: true,
                        items: {
                            include: {
                                product: true
                            }
                        }
                    }
                },
                newSale: true
            }
        });

        if (!returnRecord) {
            throw new NotFoundException('Devolución no encontrada');
        }

        return returnRecord;
    }

    /**
     * Actualizar devolución
     */
    async update(id: string, updateReturnDto: UpdateReturnDto) {
        return this.prisma.return.update({
            where: { id },
            data: updateReturnDto,
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                originalSale: true
            }
        });
    }
}
