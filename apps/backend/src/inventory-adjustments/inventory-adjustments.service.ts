import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdjustmentDto,
  AdjustmentType,
  AdjustmentReason,
} from './dto/create-adjustment.dto';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(private prisma: PrismaService) {}

/**
   * Creates a new inventory adjustment.
   * Updates the product's stock and records the adjustment in a transaction.
   * @param createAdjustmentDto The data for the inventory adjustment.
   * @param user The authenticated user performing the adjustment.
   * @returns The created inventory adjustment record.
   */
  async create(createAdjustmentDto: CreateAdjustmentDto, user: any) {
// 1. Get current product with currency for proper conversion
    const product = await this.prisma.product.findUnique({
      where: { id: createAdjustmentDto.productId },
      include: { currency: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get primary currency for the expense (system's base currency)
    const primaryCurrency = await this.prisma.currency.findFirst({
      where: { isPrimary: true },
    });

    // Determine which cost price to use based on product currency
    // - If product is in primary currency, use costPrice
    // - If product is in secondary currency, use secondaryCostPrice if available, else costPrice
    let productCostValue: number | null = null;
    if (product.currency?.isPrimary) {
      productCostValue = product.costPrice ? Number(product.costPrice) : null;
    } else {
      productCostValue = product.secondaryCostPrice
        ? Number(product.secondaryCostPrice)
        : product.costPrice
          ? Number(product.costPrice)
          : null;
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

      // Build adjustment data
      const adjustmentData: any = {
        productId: createAdjustmentDto.productId,
        type: createAdjustmentDto.type,
        quantity: createAdjustmentDto.quantity,
        previousStock,
        newStock,
        reason: createAdjustmentDto.reason,
        notes: createAdjustmentDto.notes,
        performedBy: user.username || user.name || 'Unknown', // Force authenticated user
      };

      // 4. Create expense for DAMAGE or LOSS adjustments (DECREASE only)
      // Skip for INCREASE (that's stock entry, not a loss)
      if (createAdjustmentDto.type === AdjustmentType.DECREASE) {
        const isLossReason =
          createAdjustmentDto.reason === AdjustmentReason.DAMAGE ||
          createAdjustmentDto.reason === AdjustmentReason.LOSS;

        if (isLossReason && productCostValue && productCostValue > 0) {
          // productCost is in the product's currency (already determined above)
          // If product is in secondary currency, convert to primary using exchangeRate
          // exchangeRate in DB: 1 secondary unit = exchangeRate primary units (e.g., 1 USD = 620 VES)
          const productRate = product.currency?.isPrimary
            ? 1
            : Number(product.currency?.exchangeRate ?? 1);

          // Convert cost to primary currency
          const costInPrimary = productCostValue * productRate;

          const impact =
            Number(createAdjustmentDto.quantity) * costInPrimary;

          // Use primary currency code for expense (amount already in primary)
          const expenseCurrencyCode = primaryCurrency?.code || 'VES';

          const expenseDescription = `Pérdida de inventario - ${product.name} (${createAdjustmentDto.reason})`;
          const expenseNotes = createAdjustmentDto.notes
            ? `${createAdjustmentDto.notes} | Ajuste automático por ${createAdjustmentDto.reason}`
            : `Ajuste automático por ${createAdjustmentDto.reason}`;

          const expense = await prisma.expense.create({
            data: {
              description: expenseDescription,
              amount: impact,
              currencyCode: expenseCurrencyCode,
              exchangeRate: 1,
              category: 'INVENTORY_LOSS',
              paymentMethod: 'NONE',
              notes: expenseNotes,
              userId: user.id,
            },
          });

          adjustmentData.expenseId = expense.id;
        }
      }

      // Create adjustment record
      return prisma.inventoryAdjustment.create({
        data: adjustmentData,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stock: true,
            },
          },
          expense: true,
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
