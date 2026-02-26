import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(createPurchaseDto: CreatePurchaseDto) {
    const { supplierId, items, purchaseOrderId, ...purchaseData } =
      createPurchaseDto;

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
    const itemsWithTotal: any[] = []; // Explicitly typed as any[] to avoid never[] inference, or better define interface

    // Verify currency and get conversion rate
    const currencyCode = purchaseData.currencyCode || 'VES';
    const exchangeRate = purchaseData.exchangeRate || 1;

    // Find currency entity to get its ID for product update
    const currency = await this.prisma.currency.findUnique({
      where: { code: currencyCode },
    });

    if (!currency) {
      throw new NotFoundException(`Moneda ${currencyCode} no encontrada`);
    }

    // Validations and calculations
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
        oldCost: product.costPrice,
      });
    }

    // Calculate tax (Assuming 16% or 0 based on product? Purchase usually comes with tax info from invoice)
    // For now simplifed: The DTO didn't request total/tax, so we calculate or expect it?
    // In schema schema `taxAmount` is required.
    // Let's assume standard tax or 0 for now until tax logic is more complex.
    // Ideally user inputs tax from invoice. But DTO didn't have it.
    // Let's calculate based on products tax status? Too complex for now.
    // Let's assume input totals or calculate 0 tax for now and fix later if needed or add to DTO.
    // Actually schema requires `taxAmount`, `subtotal`, `total`.
    // I should calculate them or accept them.
    // Let's calculate simple 0 tax for MVP or 16%?
    // Let's add `total` and `tax` to DTO or calculate.
    // I'll calculate subtotal from items.
    // I'll assume 0 tax for now to avoid specific tax logic issues unless products have tax.
    const taxRate = 0; // TODO: Get from settings or per product
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Calculate initial balance
    const paidAmount = purchaseData.paidAmount || 0;
    const balance = total - paidAmount;
    const paymentStatus =
      balance <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    // Track products with cost changes for price update suggestions
    const productsWithCostChange: any[] = [];

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          ...purchaseData,
          supplierId,
          subtotal,
          taxAmount,
          total,
          // Payment tracking
          paidAmount,
          balance,
          dueDate: purchaseData.dueDate,
          purchaseOrderId,

          items: {
            create: itemsWithTotal.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              cost: item.cost,
              total: item.total,
              oldCost: item.oldCost,
            })),
          },
          // If initial payment exists, create it
          payments:
            paidAmount > 0
              ? {
                  create: {
                    amount: paidAmount,
                    paymentMethod: 'CASH', // Default or need DTO field
                    notes: 'Pago inicial al registrar compra',
                  },
                }
              : undefined,
        },
        include: {
          items: true,
          supplier: true,
          payments: true,
        },
      });

      // 2. Update Stock and Cost for each product
      for (const item of itemsWithTotal) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            costPrice: true,
            salePrice: true,
            offerPrice: true,
            wholesalePrice: true,
          },
        });

        if (!product) continue;

        // Detect cost change
        const oldCost = Number(product.costPrice);
        const newCost = Number(item.cost);
        const costChanged = Math.abs(oldCost - newCost) > 0.001; // Tolerance for float comparison

        if (costChanged && oldCost > 0) {
          // Calculate current margins (only if sale prices exist)
          const salePrice = Number(product.salePrice);
          const offerPrice = product.offerPrice
            ? Number(product.offerPrice)
            : null;
          const wholesalePrice = product.wholesalePrice
            ? Number(product.wholesalePrice)
            : null;

          const salePriceMargin =
            salePrice > 0 ? ((salePrice - oldCost) / oldCost) * 100 : 0;
          const offerPriceMargin =
            offerPrice && offerPrice > 0
              ? ((offerPrice - oldCost) / oldCost) * 100
              : null;
          const wholesalePriceMargin =
            wholesalePrice && wholesalePrice > 0
              ? ((wholesalePrice - oldCost) / oldCost) * 100
              : null;

          productsWithCostChange.push({
            productId: product.id,
            productName: product.name,
            oldCost,
            newCost,
            currentSalePrice: salePrice,
            currentOfferPrice: offerPrice,
            currentWholesalePrice: wholesalePrice,
            salePriceMargin,
            offerPriceMargin,
            wholesalePriceMargin,
            // Calculate suggested new prices
            suggestedSalePrice: newCost * (1 + salePriceMargin / 100),
            suggestedOfferPrice:
              offerPriceMargin !== null
                ? newCost * (1 + offerPriceMargin / 100)
                : null,
            suggestedWholesalePrice:
              wholesalePriceMargin !== null
                ? newCost * (1 + wholesalePriceMargin / 100)
                : null,
            currencyId: currency.id,
          });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            // REMOVED: costPrice and currencyId update here.
            // These will be updated only if the user confirms the price update suggested in the frontend.
          },
        });
      }

      // 3. Mark the order as COMPLETED if linked
      if (purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: 'COMPLETED' },
        });
      }

      return {
        ...purchase,
        productsWithCostChange, // Include this in response for frontend
      };
    });
  }

  async findAll() {
    return this.prisma.purchase.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con ID ${id} no encontrada`);
    }

    return purchase;
  }

  async registerPayment(dto: any) {
    const {
      purchaseId,
      amount,
      paymentMethod,
      reference,
      notes,
      paymentAmount,
      currencyCode,
      exchangeRate,
      bankAccountId,
    } = dto;

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { supplier: true },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    if (purchase.paymentStatus === 'PAID') {
      throw new BadRequestException('Esta compra ya está pagada');
    }

    if (Number(purchase.balance) < Number(amount)) {
      throw new BadRequestException(
        `El monto excede el saldo pendiente (${purchase.balance})`,
      );
    }

    // 1. Pre-validation for Bank Balance if applicable
    let amountToDeductFromBank = 0;
    let bankAccount: any = null;

    if (bankAccountId) {
      bankAccount = await this.prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        include: { currency: true } as any,
      });

      if (!bankAccount) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      // Calculate how much we take from the bank
      // The payment currency is 'currencyCode' and amount is 'paymentAmount'
      const pAmount = Number(paymentAmount || amount);
      const pCurrency = currencyCode || purchase.currencyCode;
      const rate = Number(exchangeRate || 1);

      amountToDeductFromBank = pAmount;

      if (pCurrency !== bankAccount.currency.code) {
        if (bankAccount.currency.isPrimary) {
          // Bank is VES, Payment is USD
          amountToDeductFromBank = pAmount * rate;
        } else {
          // Bank is USD, Payment is VES
          amountToDeductFromBank = pAmount / rate;
        }
      }

      if (Number(bankAccount.balance) < amountToDeductFromBank) {
        throw new BadRequestException(
          `Saldo insuficiente en cuenta bancaria. Saldo: ${bankAccount.balance}, Requerido: ${amountToDeductFromBank}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Create Payment
      const payment = await tx.purchasePayment.create({
        data: {
          purchaseId,
          amount,
          paymentAmount: paymentAmount || amount,
          currencyCode: currencyCode || purchase.currencyCode,
          exchangeRate: exchangeRate || 1,
          paymentMethod,
          reference,
          notes,
          bankAccountId,
        },
      });

      // 3. Handle Bank Integration
      if (bankAccountId && bankAccount) {
        // Create Bank Movement (type OUT)
        const movement = await tx.bankMovement.create({
          data: {
            bankAccountId,
            type: 'OUT',
            amount: amountToDeductFromBank,
            category: 'PURCHASE',
            description: `Pago a Proveedor: ${purchase.supplier.comercialName} (Factura: ${purchase.invoiceNumber || 'N/A'})`,
            reference: reference || `PAY-${payment.id.substring(0, 8)}`,
            date: new Date(),
          },
        });

        // Link movement to payment
        await tx.purchasePayment.update({
          where: { id: payment.id },
          data: { bankMovementId: movement.id },
        });

        // Update Bank Balance
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { balance: { decrement: amountToDeductFromBank } },
        });
      }

      // 4. Update Purchase Balance
      const newPaidAmount = Number(purchase.paidAmount) + Number(amount);
      const newBalance = Number(purchase.total) - newPaidAmount;
      const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIAL'; // Tolerance for float

      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus: newStatus,
        },
      });

      return payment;
    });
  }
}
