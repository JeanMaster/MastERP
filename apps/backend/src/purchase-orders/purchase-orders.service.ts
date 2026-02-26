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

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    const { supplierId, items, ...orderData } = createPurchaseOrderDto;

    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Proveedor con ID ${supplierId} no encontrado`,
      );
    }

    // Calculate totals
    let subtotal = 0;
    const itemsWithTotal: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${item.productId} no encontrado`,
        );
      }

      const itemTotal = item.quantity * item.cost;
      subtotal += itemTotal;

      itemsWithTotal.push({
        ...item,
        total: itemTotal,
      });
    }

    // Simplified tax logic (0 for now, same as purchases for consistency)
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
      throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
    }

    return order;
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string) {
    // Only allow removing if PENDING or CANCELLED
    const order = await this.findOne(id);
    if (order.status === 'COMPLETED') {
      throw new BadRequestException(
        'No se puede eliminar un pedido ya completado',
      );
    }

    return this.prisma.purchaseOrder.delete({
      where: { id },
    });
  }
}
