import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdjustmentDto, AdjustmentType } from './dto/create-adjustment.dto';

@Injectable()
export class InventoryAdjustmentsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Crear ajuste de inventario
     */
    async create(createAdjustmentDto: CreateAdjustmentDto) {
        // 1. Obtener producto actual
        const product = await this.prisma.product.findUnique({
            where: { id: createAdjustmentDto.productId }
        });

        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }

        // 2. Calcular nuevo stock
        const previousStock = Number(product.stock);
        let newStock = previousStock;

        if (createAdjustmentDto.type === AdjustmentType.INCREASE) {
            newStock += Number(createAdjustmentDto.quantity);
        } else {
            newStock -= Number(createAdjustmentDto.quantity);

            if (newStock < 0) {
                throw new BadRequestException(
                    `Stock insuficiente. Stock actual: ${previousStock}, intentando decrementar: ${createAdjustmentDto.quantity}`
                );
            }
        }

        // 3. Usar transacción para actualizar producto y crear registro
        return this.prisma.$transaction(async (prisma) => {
            // Actualizar stock del producto
            await prisma.product.update({
                where: { id: createAdjustmentDto.productId },
                data: { stock: newStock }
            });

            // Crear registro de ajuste
            return prisma.inventoryAdjustment.create({
                data: {
                    productId: createAdjustmentDto.productId,
                    type: createAdjustmentDto.type,
                    quantity: createAdjustmentDto.quantity,
                    previousStock,
                    newStock,
                    reason: createAdjustmentDto.reason,
                    notes: createAdjustmentDto.notes,
                    performedBy: createAdjustmentDto.performedBy || 'Sistema'
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            stock: true
                        }
                    }
                }
            });
        });
    }

    /**
     * Listar ajustes con filtros
     */
    async findAll(filters?: any) {
        const where: any = {};

        if (filters?.productId) {
            where.productId = filters.productId;
        }

        if (filters?.type) {
            where.type = filters.type;
        }

        if (filters?.reason) {
            where.reason = filters.reason;
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

        return this.prisma.inventoryAdjustment.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        stock: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Obtener ajuste por ID
     */
    async findOne(id: string) {
        const adjustment = await this.prisma.inventoryAdjustment.findUnique({
            where: { id },
            include: {
                product: true
            }
        });

        if (!adjustment) {
            throw new NotFoundException('Ajuste no encontrado');
        }

        return adjustment;
    }

    /**
     * Obtener historial de ajustes de un producto
     */
    async findByProduct(productId: string) {
        return this.prisma.inventoryAdjustment.findMany({
            where: { productId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        stock: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
