import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdjustmentDto,
  AdjustmentType,
} from './dto/create-adjustment.dto';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new inventory adjustment.
   * Updates the product's stock and records the adjustment in a transaction.
   * @param createAdjustmentDto The data for the inventory adjustment.
   * @returns The created inventory adjustment record.
   */
  async create(createAdjustmentDto: CreateAdjustmentDto) {
    // 1. Get current product
    const product = await this.prisma.product.findUnique({
      where: { id: createAdjustmentDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. Calculate new stock
    const previousStock = Number(product.stock);
    let newStock = previousStock;

    if (createAdjustmentDto.type === AdjustmentType.INCREASE) {
      newStock += Number(createAdjustmentDto.quantity);
    } else {
      newStock -= Number(createAdjustmentDto.quantity);

      if (newStock < 0) {
        throw new BadRequestException(
          `Insufficient stock. Current stock: ${previousStock}, attempting to decrease by: ${createAdjustmentDto.quantity}`,
        );
      }
    }

    // 3. Use transaction to update product and create the adjustment record
    return this.prisma.$transaction(async (prisma) => {
      // Update product stock
      await prisma.product.update({
        where: { id: createAdjustmentDto.productId },
        data: { stock: newStock },
      });

      // Create adjustment record
      return prisma.inventoryAdjustment.create({
        data: {
          productId: createAdjustmentDto.productId,
          type: createAdjustmentDto.type,
          quantity: createAdjustmentDto.quantity,
          previousStock,
          newStock,
          reason: createAdjustmentDto.reason,
          notes: createAdjustmentDto.notes,
          performedBy: createAdjustmentDto.performedBy || 'System',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stock: true,
            },
          },
        },
      });
    });
  }

  /**
   * Retrieves a list of inventory adjustments based on filters.
   * @param filters Filtering criteria (productId, type, reason, date range).
   * @returns A list of matching inventory adjustments.
   */
  async findAll(filters?: {
    productId?: string;
    type?: AdjustmentType;
    reason?: string;
    startDate?: string;
    endDate?: string;
  }) {
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
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single inventory adjustment by its ID.
   * @param id The ID of the adjustment.
   * @returns The inventory adjustment record or throws NotFoundException.
   */
  async findOne(id: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!adjustment) {
      throw new NotFoundException('Adjustment not found');
    }

    return adjustment;
  }

  /**
   * Retrieves the adjustment history for a specific product.
   * @param productId The ID of the product.
   * @returns A list of adjustments for the product.
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
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
