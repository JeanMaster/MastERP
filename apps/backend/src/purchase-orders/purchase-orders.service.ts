import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new purchase order.
   * Validates supplier and product existence, and calculates totals.
   * @param createPurchaseOrderDto The data for the new purchase order.
   * @returns The created purchase order record with its items.
   */
  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    const { supplierId, items, ...orderData } = createPurchaseOrderDto;

    // Verify supplier existence
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    // Calculate totals
    let subtotal = 0;
    const itemsWithTotal: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }

      const itemTotal = item.quantity * item.cost;
      subtotal += itemTotal;

      itemsWithTotal.push({
        ...item,
        total: itemTotal,
      });
    }

    // Simplified tax logic (0 for now, matching core purchases)
    const taxAmount = 0;
    const total = subtotal + taxAmount;

    return this.prisma.purchaseOrder.create({
      data: {
        ...orderData,
        supplierId,
        subtotal,
        taxAmount,
        total,
        status: 'PENDING',
        items: {
          create: itemsWithTotal.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            cost: item.cost,
            total: item.total,
          })),
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves all purchase orders, ordered by creation date descending.
   * @returns A list of purchase orders.
   */
  async findAll() {
    return this.prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Retrieves a single purchase order by its ID.
   * @param id The ID of the purchase order.
   * @returns The purchase order record with full details.
   */
  async findOne(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: {
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Updates the status of a purchase order.
   * @param id The ID of the purchase order.
   * @param status The new status.
   * @returns The updated purchase order record.
   */
  async updateStatus(id: string, status: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Deletes a purchase order.
   * Only allowed if the status is PENDING or CANCELLED.
   * @param id The ID of the purchase order to delete.
   * @returns The deleted purchase order record.
   */
  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Cannot delete a completed purchase order');
    }

    return this.prisma.purchaseOrder.delete({
      where: { id },
    });
  }
}
