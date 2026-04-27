import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { MovementType } from '../cash-register/dto/create-movement.dto';
import { StatsService } from '../stats/stats.service';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';
import { TaxRetentionsService } from '../tax-retentions/tax-retentions.service';
import { MarketingService } from '../marketing/marketing.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private invoiceService: InvoiceService,
    private cashRegisterService: CashRegisterService,
    private statsService: StatsService,
    private mlService: MercadoLibreService,
    private taxRetentionsService: TaxRetentionsService,
    private marketingService: MarketingService,
  ) {}

  /**
   * Creates a new sale record.
   * Handles stock validation/updates, invoice/control number generation,
   * cash movements, loyalty points, and automated credit invoices.
   * @param createSaleDto Data Transfer Object for creating a sale.
   * @returns The created sale record with items and client details.
   */
  async create(createSaleDto: CreateSaleDto) {
    const {
      items,
      invoiceNumber: reservedInvoiceNumber,
      ...saleData
    } = createSaleDto;

    // Validate products, stock and prepare items with cost
    const itemsWithCost: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          currency: true,
          components: {
            include: { componentProduct: true },
          },
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product with ID ${item.productId} not found`,
        );
      }

      // Validate stock (if applicable)
      if (product.type === 'COMPOSED') {
        // Validation for composed products: check stock of all components
        for (const component of product.components) {
          const requiredQuantity =
            Number(component.quantity) * Number(item.quantity);
          if (Number(component.componentProduct.stock) < requiredQuantity) {
            throw new BadRequestException(
              `Insufficient stock for component ${component.componentProduct.name}. ` +
                `Required: ${requiredQuantity}, Available: ${component.componentProduct.stock}`,
            );
          }
        }
      } else if (
        product.type !== 'SERVICE' &&
        Number(product.stock) > 0 &&
        Number(product.stock) < Number(item.quantity)
      ) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        );
      }

      // Calculate cost in Primary Currency
      const rate = product.currency?.isPrimary
        ? 1
        : Number(product.currency?.exchangeRate || 1);
      const costInPrimary = Number(product.costPrice || 0) * rate;

      itemsWithCost.push({
        ...item,
        cost: costInPrimary, // Capture normalized cost
        isTaxExempt: product.isTaxExempt, // Capture historical tax status
      });
    }

    // Get active cash session (if exists)
    // Prioritize the session sent by the frontend (especially for Admins in multi-cashier setups)
    let activeSession: any = null;
    if (createSaleDto.cashSessionId) {
      activeSession = await this.prisma.cashSession.findUnique({
        where: { id: createSaleDto.cashSessionId },
      });
    } else {
      // Fallback: search for the first active session (original behavior)
      activeSession = await this.cashRegisterService.getActiveSession();
    }

    // Validate that if there are VAT retentions, a client must be selected
    if (saleData.paymentMethod.includes('RETENTION_IVA') && !saleData.clientId) {
      throw new BadRequestException(
        'A client must be selected to apply VAT retentions',
      );
    }

    // Create the sale with items in a transaction
    const sale = await this.prisma.$transaction(async (prisma) => {
      // Use reserved invoice number if provided, otherwise generate a new one
      let invoiceNumber = reservedInvoiceNumber;
      if (!invoiceNumber) {
        invoiceNumber = await this.invoiceService.generateInvoiceNumber();
      }

      // Automatically generate the control number using the sales control counter
      let controlCounter = await prisma.saleControlCounter.findFirst();
      if (!controlCounter) {
        controlCounter = await prisma.saleControlCounter.create({
          data: { prefix: '00', currentNumber: 1 }
        });
      }
      const controlNumber = `${controlCounter.prefix}-${controlCounter.currentNumber.toString().padStart(8, '0')}`;
      await prisma.saleControlCounter.update({
        where: { id: controlCounter.id },
        data: { currentNumber: controlCounter.currentNumber + 1 }
      });

      // Create the sale with invoice and control numbers
      const newSale = await prisma.sale.create({
        data: {
          ...saleData,
          invoiceNumber,
          controlNumber,
          igtfAmount: createSaleDto.igtfAmount || 0,
          cashSessionId: activeSession?.id,
          couponId: createSaleDto.couponId || null,
          items: {
            create: itemsWithCost,
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  components: true,
                },
              },
            },
          },
          client: true,
        },
      });

      // Update product stock
      for (const item of newSale.items) {
        await this.updateProductStockWithTx(prisma, item.productId, Number(item.quantity), 'DECREMENT');
      }

      // --- Mercado Libre Auto-Sync Hook ---
      // After stock is updated in local DB, trigger sync for any mapped ML products
      for (const item of newSale.items) {
        // For composed products, we should ideally sync the components if they are published too.
        this.mlService
          .syncProductStock(item.productId)
          .catch((err) =>
            console.error(
              `Failed to auto-sync ML stock for product ${item.productId}:`,
              err,
            ),
          );

        // If it's composed, we might also want to sync component stocks if they are published separately
        if (item.product.type === 'COMPOSED') {
          for (const component of item.product.components) {
            this.mlService
              .syncProductStock(component.componentProductId)
              .catch(() => {});
          }
        }
      }

      // --- Loyalty Points Hook (Redemption) INSIDE Transaction ---
      if (newSale.paymentMethod.toUpperCase().includes('LOYALTY_POINTS')) {
        if (!newSale.clientId) {
          throw new Error('A registered client is required to pay with loyalty points. "CONTADO" client cannot use points.');
        }

        const methods = newSale.paymentMethod.split(', ');
        let foundAndProcessed = false;

        for (const part of methods) {
          if (part.toUpperCase().startsWith('LOYALTY_POINTS')) {
            const subparts = part.split(':');
            const pointsToRedeem = subparts[2] ? parseFloat(subparts[2]) : 0;
            
            if (pointsToRedeem <= 0) {
              throw new Error('Invalid points format or insufficient quantity for redemption.');
            }

            // This is now inside the transaction 'prisma' (tx)
            await this.marketingService.redeemPointsWithTx(
              prisma,
              newSale.clientId,
              newSale.id,
              pointsToRedeem,
              `Points redemption in Sale #${newSale.invoiceNumber}`
            );
            foundAndProcessed = true;
          }
        }

        if (!foundAndProcessed) {
          throw new Error('Error processing points payment: Points information not found in the payment method.');
        }
      }

      return newSale;
    });

    // --- Increment Coupon Usage Hook ---
    if (createSaleDto.couponId) {
      try {
        await this.prisma.coupon.update({
          where: { id: createSaleDto.couponId },
          data: { usedCount: { increment: 1 } },
        });
      } catch (error) {
        console.error('Error incrementing coupon used count:', error);
      }
    }

    // Register cash movements
    if (activeSession) {
      try {
        await this.registerCashMovements(
          activeSession.id,
          sale,
          saleData.paymentMethod,
        );
      } catch (error) {
        console.error('Error recording cash movements for sale:', error);
      }
    }

    // --- Loyalty Points Hook (Earnings) ---
    if (sale.clientId) {
      try {
        const saleTotalUSD = Number(sale.total) / (Number(sale.exchangeRate) || 1);
        await this.marketingService.earnPoints(sale.clientId, sale.id, saleTotalUSD);
      } catch (error) {
        console.error('Error earning loyalty points:', error);
      }
    }

    // Detect if there is credit in the payment method and create an invoice automatically
    if (this.hasCredit(saleData.paymentMethod)) {
      try {
        const creditInfo = this.extractCreditInfo(
          saleData.paymentMethod,
          Number(sale.total),
          Number(sale.exchangeRate),
        );

        // If it's a foreign currency credit (e.g., USD), the invoice amount must be in that currency
        const invoiceAmount = creditInfo.originalAmount || creditInfo.amount;

        // Calculate due date (30 days by default)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await this.invoiceService.createCreditInvoice({
          clientId: sale.clientId || '',
          saleId: sale.id,
          subtotal: Number(sale.subtotal),
          discount: Number(sale.discount),
          tax: Number(sale.tax),
          total: invoiceAmount,
          dueDate,
          notes: `Invoice generated automatically for credit sale - ${sale.invoiceNumber}`,
          invoiceNumber: sale.invoiceNumber,
          currencyCode: creditInfo.currencyCode,
          exchangeRate: creditInfo.exchangeRate,
        });
      } catch (error) {
        console.error('Error creating credit invoice:', error);
      }
    }

    // --- New: Detect and Process Tax Retentions from POS ---
    if (saleData.paymentMethod.includes('RETENTION_IVA')) {
      try {
        const methods = saleData.paymentMethod.split(', ');
        for (const methodPart of methods) {
          if (methodPart.startsWith('RETENTION_IVA')) {
            // Format: RETENTION_IVA:amount:voucherNumber
            const parts = methodPart.split(':');
            const amount = parseFloat(parts[1]);
            const voucherNumber = parts[2] || `POS-${sale.invoiceNumber}`;

            // Create retention record
            let invoice = await this.prisma.invoice.findFirst({
              where: { saleId: sale.id }
            });

            if (!invoice) {
              // Create a "Paid" invoice for the POS sale so we can attach the retention
              invoice = await this.invoiceService.create({
                clientId: sale.clientId || '',
                saleId: sale.id,
                subtotal: Number(sale.subtotal),
                discount: Number(sale.discount),
                tax: Number(sale.tax),
                total: Number(sale.total),
                paidAmount: Number(sale.total),
                balance: 0,
                status: 'PAID',
                notes: `Invoice generated for retention registration - ${sale.invoiceNumber}`,
                invoiceNumber: sale.invoiceNumber,
                currencyCode: 'VES',
                exchangeRate: Number(sale.exchangeRate)
              });
            }

            if (invoice) {
              await this.taxRetentionsService.create({
                invoiceId: invoice.id,
                voucherNumber,
                voucherDate: new Date(),
                type: 'IVA',
                baseAmount: Number(sale.subtotal),
                retentionPercent: Math.round((amount / Number(sale.tax)) * 100),
                amount: amount,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error processing automatic tax retention:', error);
      }
    }

    return sale;
  }

  /**
   * Registers cash movements based on the payment method.
   * Only BS cash and USD cash movements are recorded in the physical drawer.
   * Mobile payments are recorded as bank movements.
   * @param sessionId The ID of the active cash session.
   * @param sale The sale record.
   * @param paymentMethodStr The raw payment method string.
   */
  private async registerCashMovements(
    sessionId: string,
    sale: any,
    paymentMethodStr: string,
  ) {
    const methods = paymentMethodStr.split(', ');

    for (const methodPart of methods) {
      let method = methodPart;
      let amount = Number(sale.total); // Default to full amount if simple

      // If composite "METHOD:AMOUNT" or "METHOD:AMOUNT:EXTRA"
      let extraData: string | null = null;
      if (methodPart.includes(':')) {
        const parts = methodPart.split(':');
        method = parts[0].trim();
        amount = parseFloat(parts[1]);
        if (parts.length > 2) {
          extraData = parts[2];
        }
      }

      // Identify if it is Cash (VES) or Foreign Currency (USD)
      // Ignore Retention payment forms in physical cash movements
      if (method.startsWith('RETENTION')) {
        continue;
      }

      if (method === 'CASH') {
        // Cash payment in Bs
        await this.cashRegisterService.createMovement({
          sessionId,
          type: MovementType.SALE,
          amount: amount,
          currencyCode: 'VES',
          exchangeRate: 1,
          description: `Sale #${sale.invoiceNumber}`,
          saleId: sale.id,
        });
      } else if (method === 'CURRENCY_USD') {
        // Only USD goes to the drawer as physical foreign currency
        await this.cashRegisterService.createMovement({
          sessionId,
          type: MovementType.SALE,
          amount: amount,
          currencyCode: 'USD',
          exchangeRate: Number(sale.exchangeRate),
          description: `Sale #${sale.invoiceNumber} (USD)`,
          saleId: sale.id,
        });
      } else if (method === 'MOBILE' && extraData) {
        // Mobile Payment directly to Bank
        const bankId = extraData;
        if (bankId && bankId.length > 10) {
          try {
            // Create bank movement IN
            await this.prisma.bankMovement.create({
              data: {
                bankAccountId: bankId,
                type: 'IN',
                amount: amount,
                category: 'SALE',
                description: `Mobile Payment Sale #${sale.invoiceNumber}`,
                reference: `PM-${sale.invoiceNumber}`,
                createdAt: new Date(),
              },
            });

            // Update bank balance
            await this.prisma.bankAccount.update({
              where: { id: bankId },
              data: { balance: { increment: amount } },
            });
          } catch (error) {
            console.error(
              `Error registering bank movement for sale ${sale.id}:`,
              error,
            );
          }
        }
      }
    }
    // Other methods (CURRENCY_UDT, DEBIT, CREDIT, TRANSFER) do not generate physical drawer movements

    // Register the change as a cash output if it exists
    if (Number(sale.change) > 0) {
      await this.cashRegisterService.createMovement({
        sessionId,
        type: MovementType.CHANGE,
        amount: Number(sale.change),
        currencyCode: 'VES',
        exchangeRate: 1,
        description: `Change for sale #${sale.invoiceNumber}`,
        saleId: sale.id,
      });
    }
  }

  /**
   * Retrieves all sale records.
   * @returns A list of sales with items and client details.
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
   * Retrieves sales records matching specific filters.
   * Calculates revalued totals and summary statistics.
   * @param filters Filtering criteria (dates, client, amount, etc.).
   * @returns Filtered sales and summary statistics.
   */
  async findWithFilters(filters: any) {
    const where: any = {};

    // Filter by invoice number
    if (filters.invoiceNumber) {
      where.invoiceNumber = {
        contains: filters.invoiceNumber,
        mode: 'insensitive',
      };
    }

    // Filter by date range
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

    // Filter by client
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    // Filter by payment method
    if (filters.paymentMethod) {
      where.paymentMethod = {
        contains: filters.paymentMethod,
        mode: 'insensitive',
      };
    }

    // Filter by amount
    if (filters.minAmount || filters.maxAmount) {
      where.total = {};
      if (filters.minAmount) {
        where.total.gte = filters.minAmount;
      }
      if (filters.maxAmount) {
        where.total.lte = filters.maxAmount;
      }
    }

    // Filter by product
    if (filters.productId) {
      where.items = {
        some: {
          productId: filters.productId,
        },
      };
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        client: true,
        returns: {
          where: { status: 'COMPLETED' },
          include: { items: true, replacementItems: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate revalued totals and summary
    const { factor: crossRateFactor, currentRefRate } =
      await this.statsService.getCrossRateFactor('VES');

    let totalRevenueTarget = 0;
    let totalRevenueNominal = 0;
    let totalDiscountTarget = 0;

    const processedSales = sales.map((sale) => {
      const historicalRate =
        Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1
          ? Number(sale.exchangeRate)
          : currentRefRate;

      // 1. Revalued Gross Sale
      const saleGrossTarget =
        (Number(sale.total) / historicalRate) * crossRateFactor;

      // 1.1 Nominal Gross Sale (Raw amount paid)
      const saleGrossNominal = Number(sale.total);

      // 2. Adjustments for returns/exchanges
      let adjustmentsTarget = 0;
      let adjustmentsNominal = 0;

      sale.returns.forEach((ret) => {
        const returnedValueVES = ret.items.reduce(
          (sum, item) => sum + Number(item.total),
          0,
        );
        adjustmentsTarget -=
          (returnedValueVES / historicalRate) * crossRateFactor;
        adjustmentsNominal -= returnedValueVES;

        if (ret.returnType.startsWith('EXCHANGE')) {
          const replacementValueVES = ret.replacementItems.reduce(
            (sum, item) => sum + Number(item.total),
            0,
          );
          adjustmentsTarget +=
            (replacementValueVES / currentRefRate) * crossRateFactor;
          adjustmentsNominal += replacementValueVES;
        }
      });

      const saleNetTarget = saleGrossTarget + adjustmentsTarget;
      const saleNetNominal = saleGrossNominal + adjustmentsNominal;
      const saleDiscountTarget =
        (Number(sale.discount) / historicalRate) * crossRateFactor;

      totalRevenueTarget += saleNetTarget;
      totalRevenueNominal += saleNetNominal;
      totalDiscountTarget += saleDiscountTarget;

      // Apply POS rounding: round up to nearest 10 (same as POS)
      const roundToNearest10 = (price: number) => Math.ceil(price / 10) * 10;
      const roundedNetTarget = roundToNearest10(saleNetTarget);

      return {
        ...sale,
        netTotal: roundedNetTarget,
        revaluedTotal: roundedNetTarget, // Alias for frontend compatibility if needed
      };
    });

    return {
      sales: processedSales,
      summary: {
        totalSales: processedSales.length,
        grossRevenue: totalRevenueTarget,
        nominalRevenue: totalRevenueNominal,
        discounts: totalDiscountTarget,
        averageTicket:
          processedSales.length > 0
            ? totalRevenueTarget / processedSales.length
            : 0,
      },
    };
  }

  /**
   * Retrieves the most recent purchases for a specific client.
   * @param clientId The ID of the client.
   * @param limit The maximum number of purchases to retrieve. Defaults to 5.
   * @returns A list of recent purchases.
   */
  async getClientRecentPurchases(clientId: string, limit: number = 5) {
    return this.prisma.sale.findMany({
      where: {
        clientId,
        active: true,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  /**
   * Retrieves a single sale record by its ID.
   * @param id The ID of the sale.
   * @returns The sale record with items and client details.
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
      throw new BadRequestException(`Sale with ID ${id} not found`);
    }

    return sale;
  }

  /**
   * Updates the payment method of an existing sale.
   * @param id The ID of the sale.
   * @param paymentMethod The new payment method string.
   * @returns The updated sale record.
   */
  async updatePaymentMethod(id: string, paymentMethod: string) {
    // Verify that the sale exists
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      throw new BadRequestException(`Sale with ID ${id} not found`);
    }

    return this.prisma.sale.update({
      where: { id },
      data: { paymentMethod },
    });
  }

  /**
   * Deletes a sale record and restores product stock.
   * If it is the latest sale, it also decrements the invoice counter.
   * @param id The ID of the sale to delete.
   * @returns The deleted sale record.
   */
  async remove(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      throw new BadRequestException(`Sale with ID ${id} not found`);
    }

    return await this.prisma.$transaction(async (prisma) => {
      // 1. Restore stock
      for (const item of sale.items) {
        await this.updateProductStockWithTx(prisma, item.productId, Number(item.quantity), 'INCREMENT');
      }

      // 2. Delete associated cash movements
      await prisma.cashMovement.deleteMany({ where: { saleId: id } });

      // 3. Delete credit invoice if exists
      await prisma.invoice.deleteMany({ where: { saleId: id } });

      // 4. Check if it is the latest invoice to roll back the counter
      const latestSale = await prisma.sale.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (latestSale && latestSale.id === id) {
        const counter = await prisma.invoiceCounter.findFirst();
        if (counter && counter.currentNumber > 1) {
          await prisma.invoiceCounter.update({
            where: { id: counter.id },
            data: { currentNumber: { decrement: 1 } },
          });
        }
      }

      await prisma.saleItem.deleteMany({ where: { saleId: id } });
      return prisma.sale.delete({ where: { id } });
    });
  }

  /**
   * Marks a sale as uncollectible (e.g., loss/theft).
   * Deletes the sale and debt but DOES NOT restore stock.
   * @param id The ID of the sale.
   */
  async markAsUncollectible(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      throw new BadRequestException(`Sale with ID ${id} not found`);
    }

    return await this.prisma.$transaction(async (prisma) => {
      // 1. SKIP RESTOCKING (This is the key difference)
      // We assume the items are lost/stolen/consumed.

      // 2. Delete associated cash movements
      await prisma.cashMovement.deleteMany({ where: { saleId: id } });

      // 3. Delete credit invoice if exists
      await prisma.invoice.deleteMany({ where: { saleId: id } });

      // 4. Check if it is the latest invoice to roll back the counter
      const latestSale = await prisma.sale.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (latestSale && latestSale.id === id) {
        const counter = await prisma.invoiceCounter.findFirst();
        if (counter && counter.currentNumber > 1) {
          await prisma.invoiceCounter.update({
            where: { id: counter.id },
            data: { currentNumber: { decrement: 1 } },
          });
        }
      }

      // 5. Delete items and sale
      await prisma.saleItem.deleteMany({ where: { saleId: id } });
      return prisma.sale.delete({ where: { id } });
    });
  }

  /**
   * Internal helper to update product stock within a transaction.
   * Handles composed products by updating component stock.
   * @param prisma The transaction context.
   * @param productId The ID of the product.
   * @param quantity The quantity to adjust.
   * @param type 'INCREMENT' (restock) or 'DECREMENT' (sold).
   */
  private async updateProductStockWithTx(
    prisma: any,
    productId: string,
    quantity: number,
    type: 'INCREMENT' | 'DECREMENT'
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { components: true },
    });

    if (!product) return;

    if (product.type === 'COMPOSED') {
      for (const component of product.components) {
        const adjustmentQuantity = Number(component.quantity) * quantity;
        await prisma.product.update({
          where: { id: component.componentProductId },
          data: {
            stock: {
              [type.toLowerCase()]: adjustmentQuantity,
            },
          },
        });
      }
    } else if (product.type !== 'SERVICE') {
      await prisma.product.update({
        where: { id: productId },
        data: {
          stock: {
            [type.toLowerCase()]: quantity,
          },
        },
      });
    }
  }

  /**
   * Helper to check if the payment method involves credit.
   * @param paymentMethod The raw payment method string.
   * @returns True if credit is involved.
   */
  private hasCredit(paymentMethod: string): boolean {
    return paymentMethod.toUpperCase().includes('ACCOUNT_CREDIT');
  }

  /**
   * Helper to extract detailed credit information (amount, currency, rate).
   * @param paymentMethod The raw payment method string.
   * @param totalAmount The total amount of the sale.
   * @param saleRate The exchange rate used for the sale.
   * @returns Detailed credit information.
   */
  private extractCreditInfo(
    paymentMethod: string,
    totalAmount: number,
    saleRate: number = 1,
  ): {
    amount: number; // in Bs
    currencyCode: string;
    exchangeRate: number;
    originalAmount?: number; // in foreign currency if applicable
  } {
    const methods = paymentMethod.split(', ');

    for (const methodPart of methods) {
      if (methodPart.toUpperCase().includes('ACCOUNT_CREDIT')) {
        // Format: ACCOUNT_CREDIT_USD:10.5:45.5 (METHOD_CURRENCY:FOREIGN_AMOUNT:RATE)
        // Or simple: ACCOUNT_CREDIT:500 (METHOD:BS_AMOUNT)
        const mainParts = methodPart.split(':');
        const methodKey = mainParts[0];
        const isForeign = methodKey.includes('_');
        const amount = mainParts[1] ? parseFloat(mainParts[1]) : totalAmount;

        const defaultRate = isForeign ? (saleRate > 1 ? saleRate : 1) : 1;
        const rate = mainParts[2] ? parseFloat(mainParts[2]) : defaultRate;

        const currencyCode = isForeign ? methodKey.split('_')[2] : 'VES';

        return {
          amount: currencyCode === 'VES' ? amount : amount * rate,
          currencyCode,
          exchangeRate: rate,
          originalAmount: currencyCode === 'VES' ? undefined : amount,
        };
      }
    }

    return { amount: totalAmount, currencyCode: 'VES', exchangeRate: 1 };
  }
}
