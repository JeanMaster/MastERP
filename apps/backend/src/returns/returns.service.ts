import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReturnDto,
  ReturnType,
  ProductCondition,
} from './dto/create-return.dto';
import { UpdateReturnDto, ReturnStatus } from './dto/update-return.dto';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates the next Credit Note number in sequence (e.g., NC-00000001).
   */
  private async generateCreditNoteNumber(): Promise<string> {
    const lastReturn = await this.prisma.return.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { creditNoteNumber: true },
    });

    if (!lastReturn) {
      return 'NC-00000001';
    }

    const lastNumber = parseInt(lastReturn.creditNoteNumber.split('-')[1]);
    const nextNumber = lastNumber + 1;
    return `NC-${nextNumber.toString().padStart(8, '0')}`;
  }

  /**
   * Validates whether a return is eligible for the given sale and items.
   * Checks sale status, existing returns, product returnability, deadlines, and quantity.
   * @param saleId The ID of the original sale.
   * @param items The items to be returned.
   * @returns An object indicating eligibility and an optional error message.
   */
  async validateReturnEligibility(
    saleId: string,
    items: any[],
  ): Promise<{ eligible: boolean; message?: string }> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      return { eligible: false, message: 'Sale not found' };
    }

    if (!sale.active || sale.isCancelled) {
      return { eligible: false, message: 'Sale is inactive or cancelled' };
    }

    // Check if an active return already exists for this sale
    const existingReturns = await this.prisma.return.findMany({
      where: {
        originalSaleId: saleId,
        status: {
          in: ['PENDING', 'APPROVED', 'COMPLETED'],
        },
      },
      include: {
        items: true,
      },
    });

    if (existingReturns.length > 0) {
      const pendingOrApproved = existingReturns.find(
        (r) => r.status === 'PENDING' || r.status === 'APPROVED',
      );
      if (pendingOrApproved) {
        return {
          eligible: false,
          message: `A ${pendingOrApproved.status === 'PENDING' ? 'pending' : 'approved'} return already exists for this invoice (${pendingOrApproved.creditNoteNumber})`,
        };
      }
    }

    // Validate each returned product
    for (const returnItem of items) {
      const saleItem = sale.items.find(
        (i) => i.productId === returnItem.productId,
      );

      if (!saleItem) {
        return {
          eligible: false,
          message: `Product ${returnItem.productId} is not part of this sale`,
        };
      }

      if (!saleItem.product.isReturnable) {
        return {
          eligible: false,
          message: `Product "${saleItem.product.name}" is not returnable`,
        };
      }

      // Validate return deadline
      const deadlineDays = saleItem.product.returnDeadlineDays || 30;
      const saleDate = new Date(sale.date);
      const today = new Date();
      const daysDiff = Math.floor(
        (today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff > deadlineDays) {
        return {
          eligible: false,
          message: `Return deadline expired (${deadlineDays} days)`,
        };
      }

      // Validate quantity against previous returns
      const previousReturns = await this.prisma.returnItem.findMany({
        where: {
          productId: returnItem.productId,
          return: {
            originalSaleId: saleId,
            status: { in: ['APPROVED', 'COMPLETED'] },
          },
        },
      });

      const totalReturned = previousReturns.reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      );
      const availableToReturn = Number(saleItem.quantity) - totalReturned;

      if (returnItem.quantity > availableToReturn) {
        return {
          eligible: false,
          message: `Return quantity exceeds available for "${saleItem.product.name}". Available: ${availableToReturn}`,
        };
      }

      if (availableToReturn === 0) {
        return {
          eligible: false,
          message: `Product "${saleItem.product.name}" has already been fully returned`,
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Creates a new return record.
   * Validates eligibility, generates the credit note number, and records the return.
   * @param createReturnDto The return data.
   * @param user The authenticated user requesting the return.
   * @returns The created return record.
   */
  async create(createReturnDto: CreateReturnDto, user: any) {
    // Validate eligibility
    const validation = await this.validateReturnEligibility(
      createReturnDto.originalSaleId,
      createReturnDto.items,
    );

    if (!validation.eligible) {
      throw new BadRequestException(validation.message);
    }

    // Generate Credit Note number
    const creditNoteNumber = await this.generateCreditNoteNumber();

    // Generate control number
    let controlCounter = await this.prisma.saleControlCounter.findFirst();
    if (!controlCounter) {
      controlCounter = await this.prisma.saleControlCounter.create({
        data: { prefix: '00', currentNumber: 1 },
      });
    }
    const controlNumber = `${controlCounter.prefix}-${controlCounter.currentNumber.toString().padStart(8, '0')}`;
    await this.prisma.saleControlCounter.update({
      where: { id: controlCounter.id },
      data: { currentNumber: controlCounter.currentNumber + 1 },
    });

    // 🛡️ SECURITY: Calculate real refund amount based on original sale prices
    const sale = await this.prisma.sale.findUnique({
      where: { id: createReturnDto.originalSaleId },
      include: { items: true }
    });

    let calculatedMaxRefund = 0;
    for (const item of createReturnDto.items) {
      const originalItem = sale?.items.find(i => i.productId === item.productId);
      if (originalItem) {
        calculatedMaxRefund += Number(originalItem.unitPrice) * Number(item.quantity);
      }
    }

    // Allow for small rounding differences
    if (createReturnDto.refundAmount > calculatedMaxRefund + 0.01) {
      throw new BadRequestException(
        `Security Alert: Refund amount (${createReturnDto.refundAmount}) exceeds original purchase value (${calculatedMaxRefund}).`
      );
    }

    // Create the return record
    const returnRecord = await this.prisma.return.create({
      data: {
        originalSaleId: createReturnDto.originalSaleId,
        creditNoteNumber,
        controlNumber,
        returnType: createReturnDto.returnType,
        reason: createReturnDto.reason,
        productCondition: createReturnDto.productCondition,
        refundAmount: createReturnDto.refundAmount || calculatedMaxRefund,
        refundMethod: createReturnDto.refundMethod,
        notes: createReturnDto.notes,
        requestedBy: user.username || user.name || 'Unknown', // Force authenticated user
        items: {
          create: createReturnDto.items,
        },
        replacementItems: createReturnDto.replacementItems
          ? {
              create: createReturnDto.replacementItems,
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        originalSale: true,
      },
    });

    // Mark the original sale as having returns
    await this.prisma.sale.update({
      where: { id: createReturnDto.originalSaleId },
      data: { hasReturns: true },
    });

    return returnRecord;
  }

  /**
   * Approves a pending return request.
   * @param id The ID of the return.
   * @param approvedBy The username of the approving administrator.
   * @returns The updated return record.
   */
  async approve(id: string, approvedBy: string) {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRecord) {
      throw new NotFoundException('Return not found');
    }

    if (returnRecord.status !== 'PENDING') {
      throw new BadRequestException('Only pending returns can be approved');
    }

    return this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        originalSale: true,
      },
    });
  }

  /**
   * Rejects a pending return request.
   * @param id The ID of the return.
   * @param reason The reason for rejection.
   * @returns The updated return record.
   */
  async reject(id: string, reason: string) {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
    });

    if (!returnRecord) {
      throw new NotFoundException('Return not found');
    }

    if (returnRecord.status !== 'PENDING') {
      throw new BadRequestException('Only pending returns can be rejected');
    }

    return this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.REJECTED,
        notes: `${returnRecord.notes || ''}\n[REJECTED]: ${reason}`,
      },
    });
  }

  /**
   * Processes an approved return: applies stock adjustments and handles exchange differences.
   * @param id The ID of the return to process.
   * @returns The fully processed return record.
   */
  async process(id: string) {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!returnRecord) {
      throw new NotFoundException('Return not found');
    }

    if (returnRecord.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException('Only approved returns can be processed');
    }

    // These reasons result in the product being restocked (product is in good condition)
    const restorableReasons = ['ERROR', 'UNSATISFIED', 'OTHER'];
    const shouldRestoreStock = restorableReasons.includes(returnRecord.reason);

    await this.prisma.$transaction(async (prisma) => {
      // Restore stock for each returned item (only if product type is not SERVICE)
      for (const item of returnRecord.items) {
        if (item.product.type !== 'SERVICE') {
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

          // For same-product exchanges, decrement stock for the replacement unit given
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

      // For different-product exchanges, decrement stock for each replacement item
      if (returnRecord.returnType === 'EXCHANGE_DIFFERENT') {
        const returnWithReplacements = await prisma.return.findUnique({
          where: { id },
          include: { replacementItems: { include: { product: true } } },
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

      // Mark the return as COMPLETED
      await prisma.return.update({
        where: { id },
        data: {
          status: ReturnStatus.COMPLETED,
        },
      });

      // Handle exchange difference payment
      if (returnRecord.returnType === 'EXCHANGE_DIFFERENT') {
        const returnVal = returnRecord.items.reduce(
          (sum, i) => sum + Number(i.total),
          0,
        );

        const returnWithRepl = await prisma.return.findUnique({
          where: { id },
          include: { replacementItems: true },
        });

        const replacementVal =
          returnWithRepl?.replacementItems?.reduce(
            (sum, i) => sum + Number(i.total),
            0,
          ) || 0;
        const difference = replacementVal - returnVal;

        // If difference > 0, customer owes more → register as income in the active session
        if (difference > 0) {
          const activeSession = await prisma.cashSession.findFirst({
            where: { status: 'OPEN' },
          });

          if (activeSession) {
            await prisma.cashMovement.create({
              data: {
                sessionId: activeSession.id,
                type: 'SALE',
                amount: difference,
                currencyCode: 'VES',
                description: `Exchange difference for ${returnRecord.creditNoteNumber}`,
                performedBy: 'System',
              },
            });
          }
        }
      }
    });

    return this.findOne(id);
  }

  /**
   * Lists all returns with optional filters.
   * @param filters Optional status, type, and date range filters.
   * @returns A list of return records.
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
            product: true,
          },
        },
        originalSale: {
          include: {
            client: true,
          },
        },
        newSale: true,
        replacementItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single return record by its ID.
   * @param id The ID of the return.
   * @returns The full return record with all relationships.
   */
  async findOne(id: string) {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        originalSale: {
          include: {
            client: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        newSale: true,
        replacementItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!returnRecord) {
      throw new NotFoundException('Return not found');
    }

    return returnRecord;
  }

  /**
   * Updates a return record.
   * @param id The ID of the return to update.
   * @param updateReturnDto The updated data.
   * @returns The updated return record.
   */
  async update(id: string, updateReturnDto: UpdateReturnDto) {
    return this.prisma.return.update({
      where: { id },
      data: updateReturnDto,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        originalSale: true,
      },
    });
  }
}
