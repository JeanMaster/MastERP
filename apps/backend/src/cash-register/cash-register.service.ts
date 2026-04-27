import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateMovementDto, MovementType } from './dto/create-movement.dto';

@Injectable()
export class CashRegisterService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves the main cash register or creates it if it doesn't exist.
   * @returns The main cash register record.
   */
  async getOrCreateMainRegister() {
    let register = await this.prisma.cashRegister.findFirst({
      where: { isActive: true },
    });

    if (!register) {
      register = await this.prisma.cashRegister.create({
        data: {
          name: 'Main Register',
          location: 'Store',
        },
      });
    }

    return register;
  }

  /**
   * Opens a new cash session.
   * Validates that neither the register nor the cashier has another active session.
   * @param openSessionDto Data for opening the session.
   * @returns The created cash session.
   */
  async openSession(openSessionDto: OpenSessionDto) {
    // Verify that no other session is open for THIS register
    const activeSession = await this.prisma.cashSession.findFirst({
      where: {
        registerId: openSessionDto.registerId,
        status: { in: ['OPEN', 'AWAITING_CLOSE'] },
      },
    });

    if (activeSession) {
      throw new BadRequestException(
        'An open session already exists for this register',
      );
    }

    // Verify that the cashier does not have another open session in any register
    if (openSessionDto.cashierId) {
      const cashierSession = await this.prisma.cashSession.findFirst({
        where: {
          cashierId: openSessionDto.cashierId,
          status: { in: ['OPEN', 'AWAITING_CLOSE'] },
        },
      });

      if (cashierSession) {
        throw new BadRequestException(
          `Cashier ${openSessionDto.cashierId} already has an open session in another register.`,
        );
      }
    }

    // Calculate initial balance if items are provided
    let openingBalance = openSessionDto.openingBalance || 0;
    if (openSessionDto.items && openSessionDto.items.length > 0) {
      openingBalance = 0;
      const rate = openSessionDto.exchangeRate || 1;
      for (const item of openSessionDto.items) {
        const denom = await this.prisma.currencyDenomination.findUnique({
          where: { id: item.denominationId },
        });
        if (denom) {
          let amount = Number(denom.value) * item.quantity;
          if (denom.currencyCode !== 'VES') {
            amount *= rate;
          }
          openingBalance += amount;
        }
      }
    }

    // Create new session
    const session = await this.prisma.cashSession.create({
      data: {
        registerId: openSessionDto.registerId,
        openingBalance: openingBalance,
        openedBy: openSessionDto.openedBy || 'System',
        cashierId: openSessionDto.cashierId,
        openingNotes: openSessionDto.openingNotes,
        openedAt: new Date(),
        verifiedAt: openSessionDto.items ? new Date() : null,
        verifiedBy: openSessionDto.items
          ? openSessionDto.openedBy || 'System'
          : null,
        verificationDiff: openSessionDto.items ? 0 : null,
      },
      include: {
        register: true,
      },
    });

    // Save breakdown if provided
    if (openSessionDto.items && openSessionDto.items.length > 0) {
      await this.saveCashCounts(
        session.id,
        'VERIFICATION',
        openSessionDto.items,
      );
    }

    // Create opening movement
    await this.createMovement({
      sessionId: session.id,
      type: MovementType.OPENING,
      amount: openingBalance,
      currencyCode: 'VES',
      description: 'Cash register opening',
      performedBy: openSessionDto.openedBy || 'System',
    });

    return session;
  }

  /**
   * Requests a session closure (Cashier action).
   * Sets the status to AWAITING_CLOSE and records the actual balance found.
   * @param sessionId The ID of the session to close.
   * @param closeSessionDto Closing data including actual balance.
   * @returns The updated session record.
   */
  async requestCloseSession(
    sessionId: string,
    closeSessionDto: CloseSessionDto,
  ) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: { movements: true },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'OPEN')
      throw new BadRequestException(
        'The session is not open or is already in the closing process',
      );

    const expectedBalance = this.calculateExpectedBalance(
      session.movements,
      Number(session.openingBalance),
    );
    const variance =
      Number(closeSessionDto.actualBalance) - Number(expectedBalance);

    // Save cash breakdown if provided
    if (closeSessionDto.items && closeSessionDto.items.length > 0) {
      await this.saveCashCounts(sessionId, 'CLOSING', closeSessionDto.items);
    }

    return this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'AWAITING_CLOSE',
        expectedBalance,
        actualBalance: closeSessionDto.actualBalance,
        variance,
        closingNotes: closeSessionDto.closingNotes,
      },
    });
  }

  /**
   * Approves a session closure (Administrator action).
   * Records variance adjustments and handles card liquidation transfers.
   * @param sessionId The ID of the session to approve.
   * @param adminUser The username of the approving administrator.
   * @returns The closed session record.
   */
  async approveCloseSession(sessionId: string, adminUser: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'AWAITING_CLOSE')
      throw new BadRequestException('The session is not awaiting closure');

    const variance = Number(session.variance || 0);

    // If there is variance, create an ADJUSTMENT movement to square the register officially
    if (Math.abs(variance) > 0.001) {
      await this.createMovement({
        sessionId: session.id,
        type: MovementType.ADJUSTMENT,
        amount: variance, // Use variance directly (positive if surplus, negative if shortage)
        currencyCode: 'VES',
        description: `Automatic Variance Adjustment (${variance >= 0 ? 'Surplus' : 'Shortage'})`,
        performedBy: adminUser,
        notes: `Official cash squaring by authorized closure.`,
      });
    }

    // Create official closing movement (Withdrawal of total to Treasury/Closure)
    await this.createMovement({
      sessionId: session.id,
      type: MovementType.CLOSING,
      amount: Number(session.actualBalance || 0),
      currencyCode: 'VES',
      description: `Cash closure (Authorized) - Cash Delivered: ${Number(session.actualBalance || 0).toFixed(2)}`,
      performedBy: adminUser,
    });

    // --- Card Liquidation Logic (Treasury) ---
    // 1. Calculate total from cards (DEBIT, CREDIT)
    const sales = await this.prisma.sale.findMany({
      where: { cashSessionId: sessionId, isCancelled: false },
    });

    let cardTotalVES = 0;
    sales.forEach((sale) => {
      const methods = sale.paymentMethod.split(', ');
      methods.forEach((methodPart) => {
        let method = methodPart;
        let amount = Number(sale.total);
        if (methodPart.includes(':')) {
          const parts = methodPart.split(':');
          method = parts[0].trim();
          amount = parseFloat(parts[1]);
        }

        if (method === 'DEBIT' || method === 'CREDIT') {
          cardTotalVES += amount;
        }
      });
    });

    // 2. Find receiving account and update pending liquidation balance
    const targetAccount = await (this.prisma as any).bankAccount.findFirst({
      where: { receivesPosLiquidation: true, active: true },
    });

    if (targetAccount && cardTotalVES > 0) {
      await (this.prisma as any).bankAccount.update({
        where: { id: targetAccount.id },
        data: {
          pendingLiquidation: {
            increment: cardTotalVES,
          },
        },
      });
    }
    // ----------------------------------------------------

    const result = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedBy: adminUser,
        closedAt: new Date(),
      },
      include: { register: true, movements: { orderBy: { createdAt: 'asc' } } },
    });

    return result;
  }

  /**
   * Closes a cash session directly.
   * @param sessionId The ID of the session to close.
   * @param closeSessionDto Closing data.
   * @returns The closed session record.
   */
  async closeSession(sessionId: string, closeSessionDto: CloseSessionDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'CLOSED') {
      throw new BadRequestException('The session is already closed');
    }

    // Calculate expected balance
    const expectedBalance = this.calculateExpectedBalance(
      session.movements,
      Number(session.openingBalance),
    );

    // Calculate variance
    const variance =
      Number(closeSessionDto.actualBalance) - Number(expectedBalance);

    // Create closing movement
    await this.createMovement({
      sessionId: session.id,
      type: MovementType.CLOSING,
      amount: closeSessionDto.actualBalance,
      currencyCode: 'VES',
      description: `Cash closure - Variance: ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`,
      performedBy: closeSessionDto.closedBy || 'System',
    });

    // Update session
    const updatedSession = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedBy: closeSessionDto.closedBy || 'System',
        closedAt: new Date(),
        expectedBalance,
        actualBalance: closeSessionDto.actualBalance,
        variance,
        closingNotes: closeSessionDto.closingNotes,
      },
      include: {
        register: true,
        movements: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return updatedSession;
  }

  /**
   * Calculates the expected balance in base currency (VES).
   * @param movements List of movements in the session.
   * @param openingBalance The initial balance.
   * @returns The calculated expected balance.
   */
  private calculateExpectedBalance(
    movements: any[],
    openingBalance: number,
  ): number {
    let expected = Number(openingBalance);

    for (const movement of movements) {
      // The movement amount is already in its original currency
      // It's multiplied by the historical exchange rate to get the impact in Bs
      const amountInVES =
        Number(movement.amount) * Number(movement.exchangeRate || 1);

      switch (movement.type) {
        case 'SALE':
        case 'WITHDRAWAL':
        case 'OPENING':
          expected += amountInVES;
          break;
        case 'EXPENSE':
        case 'DEPOSIT':
        case 'CLOSING': // Closing subtracts from balance to reach 0
        case 'CHANGE': // Change subtracts from balance
          expected -= amountInVES;
          break;
        case 'ADJUSTMENT':
          expected += amountInVES;
          break;
      }
    }

    return expected;
  }

  /**
   * Records a movement in an active cash session.
   * @param createMovementDto Data for the movement.
   * @returns The created movement record.
   */
  async createMovement(createMovementDto: CreateMovementDto) {
    // Verify that the session exists and is open
    const session = await this.prisma.cashSession.findUnique({
      where: { id: createMovementDto.sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot add movements to a closed session',
      );
    }

    // If exchange rate is not provided, try to fetch the current rate for the currency
    let exchangeRate = createMovementDto.exchangeRate || 1;
    if (
      !createMovementDto.exchangeRate &&
      createMovementDto.currencyCode &&
      createMovementDto.currencyCode !== 'VES'
    ) {
      const currency = await this.prisma.currency.findUnique({
        where: { code: createMovementDto.currencyCode },
      });
      if (currency) {
        exchangeRate = Number(currency.exchangeRate);
      }
    }

    return this.prisma.cashMovement.create({
      data: {
        sessionId: createMovementDto.sessionId,
        type: createMovementDto.type,
        amount: createMovementDto.amount,
        currencyCode: createMovementDto.currencyCode || 'VES',
        exchangeRate: exchangeRate,
        description: createMovementDto.description,
        notes: createMovementDto.notes,
        performedBy: createMovementDto.performedBy || 'System',
        saleId: createMovementDto.saleId,
      },
    });
  }

  /**
   * Retrieves the active session for a register or cashier.
   * @param registerId Optional register filter.
   * @param cashierId Optional cashier filter.
   * @returns The active session including movements, sales, and counts.
   */
  async getActiveSession(registerId?: string, cashierId?: string) {
    const where: any = { status: { in: ['OPEN', 'AWAITING_CLOSE'] } };
    if (registerId) {
      where.registerId = registerId;
    }
    if (cashierId) {
      where.cashierId = cashierId;
    }

    return this.prisma.cashSession.findFirst({
      where,
      include: {
        register: true,
        movements: {
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          include: {
            items: true,
          },
        },
        cashCounts: true,
      },
    });
  }

  /**
   * Retrieves a cash session by its ID.
   * @param id The ID of the session.
   * @returns The session record with all details.
   */
  async getSession(id: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: {
        register: true,
        movements: {
          orderBy: { createdAt: 'asc' },
          include: {
            sale: true,
          },
        },
        sales: {
          include: {
            items: true,
          },
        },
        cashCounts: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Lists cash sessions based on optional filters.
   * @param filters Register ID, status, and date range filters.
   * @returns A list of cash sessions.
   */
  async listSessions(filters?: any) {
    const where: any = {};

    if (filters?.registerId) {
      where.registerId = filters.registerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.openedAt = {};
      if (filters.startDate) {
        where.openedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        where.openedAt.lt = endDate;
      }
    }

    return this.prisma.cashSession.findMany({
      where,
      include: {
        register: true,
        movements: {
          orderBy: { createdAt: 'asc' },
        },
        sales: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  /**
   * Verifies a session (Opening Cash Audit).
   * @param sessionId The ID of the session.
   * @param verifyDto The audit data including cash breakdown.
   * @param user The username of the verifier.
   * @returns The updated session record.
   */
  async verifySession(sessionId: string, verifyDto: any, user: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.verifiedAt) {
      throw new BadRequestException('This session has already been verified');
    }

    let totalCountedVES = 0;

    for (const item of verifyDto.items) {
      const denom = await this.prisma.currencyDenomination.findUnique({
        where: { id: item.denominationId },
      });

      if (denom) {
        let amount = Number(denom.value) * item.quantity;
        if (denom.currencyCode !== 'VES') {
          amount = amount * verifyDto.exchangeRate;
        }
        totalCountedVES += amount;
      }
    }

    const diff = totalCountedVES - Number(session.openingBalance);

    // Save cash breakdown
    if (verifyDto.items && verifyDto.items.length > 0) {
      await this.saveCashCounts(sessionId, 'VERIFICATION', verifyDto.items);
    }

    // Update session
    return this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        verifiedAt: new Date(),
        verifiedBy: user,
        verificationDiff: diff,
        openingNotes: session.openingNotes
          ? `${session.openingNotes} | Audit OK: ${diff.toFixed(2)}`
          : `Audit OK: ${diff.toFixed(2)}`,
      },
    });
  }

  /**
   * Saves a breakdown of cash (banknotes/coins).
   * @param sessionId The ID of the session.
   * @param type The count type (VERIFICATION or CLOSING).
   * @param items The list of denominations and quantities.
   */
  private async saveCashCounts(
    sessionId: string,
    type: 'VERIFICATION' | 'CLOSING',
    items: any[],
  ) {
    // Clear previous breakdowns of the same type to avoid duplicates on retries
    await this.prisma.sessionCashCount.deleteMany({
      where: {
        sessionId,
        type,
      },
    });

    // Save new items
    for (const item of items) {
      const denom = await this.prisma.currencyDenomination.findUnique({
        where: { id: item.denominationId },
      });

      if (denom) {
        await this.prisma.sessionCashCount.create({
          data: {
            sessionId,
            type,
            currencyCode: denom.currencyCode,
            value: denom.value,
            quantity: item.quantity,
            total: Number(denom.value) * item.quantity,
          },
        });
      }
    }
  }

  /**
   * Retrieves all active currency denominations.
   * @returns A list of active denominations.
   */
  async getDenominations() {
    return this.prisma.currencyDenomination.findMany({
      where: { active: true },
      orderBy: { value: 'desc' },
    });
  }

  /**
   * Transfers funds from a cash session to a bank account (Treasury).
   * @param sessionId The ID of the cash session.
   * @param bankAccountId The ID of the destination bank account.
   * @param amount The amount to transfer.
   * @param description A brief description of the transfer.
   * @param performedBy The username of the person performing the transfer.
   * @returns The created bank movement record.
   */
  transferToTreasury(
    sessionId: string,
    bankAccountId: string,
    amount: number,
    description: string,
    performedBy: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify open session
      const session = await tx.cashSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.status === 'CLOSED') {
        throw new BadRequestException(
          'The cash session must be open to perform a transfer',
        );
      }

      // 2. Get bank account info to know its currency
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: bankAccountId },
        include: { currency: true },
      });

      if (!bankAccount) {
        throw new NotFoundException('Bank account not found');
      }

      // 3. Get current exchange rate if it's a transfer in foreign currency
      let exchangeRate = 1;
      if (bankAccount.currency.code !== 'VES') {
        exchangeRate = Number(bankAccount.currency.exchangeRate);
      }

      // 4. Create WITHDRAWAL movement in Cash (Subtract from drawer)
      await tx.cashMovement.create({
        data: {
          sessionId,
          type: MovementType.DEPOSIT,
          amount,
          currencyCode: bankAccount.currency.code,
          exchangeRate,
          description: `Transfer to Treasury: ${description} (${bankAccount.currency.code})`,
          performedBy,
        },
      });

      // 5. Create INCOMING movement in Treasury (Add to bank/vault)
      const bankMovement = await tx.bankMovement.create({
        data: {
          bankAccountId,
          type: 'IN',
          amount,
          category: 'SALE_TRANSFER',
          description: `Transfer from Cash: ${description}`,
          cashSessionId: sessionId,
        },
      });

      // 6. Update bank account balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          balance: { increment: Number(amount) },
        },
      });

      return bankMovement;
    });
  }

  /**
   * Lists all cash registers with their active session status and balance.
   * @returns A list of registers with simplified active session info.
   */
  async listRegisters() {
    const registers = await this.prisma.cashRegister.findMany({
      where: { isActive: true },
      include: {
        sessions: {
          where: { status: { in: ['OPEN', 'AWAITING_CLOSE'] } },
          include: { movements: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return registers.map((r) => {
      const activeSession = r.sessions[0] || null;
      let currentBalance = 0;
      if (activeSession) {
        currentBalance = this.calculateExpectedBalance(
          activeSession.movements,
          Number(activeSession.openingBalance),
        );
      }

      return {
        ...r,
        activeSession: activeSession
          ? {
              id: activeSession.id,
              status: activeSession.status,
              openedBy: activeSession.openedBy,
              cashierId: activeSession.cashierId,
              openedAt: activeSession.openedAt,
              currentBalance,
            }
          : null,
      };
    });
  }

  /**
   * Creates a new cash register.
   * @param data Name and location of the register.
   * @returns The created register record.
   */
  async createRegister(data: { name: string; location?: string }) {
    return this.prisma.cashRegister.create({
      data: {
        name: data.name,
        location: data.location || 'Store',
        isActive: true,
      },
    });
  }

  /**
   * Updates a cash register's information.
   * @param id The ID of the register.
   * @param data The new data.
   * @returns The updated register record.
   */
  async updateRegister(
    id: string,
    data: { name?: string; location?: string; isActive?: boolean },
  ) {
    return this.prisma.cashRegister.update({
      where: { id },
      data,
    });
  }

  /**
   * Deactivates a cash register (soft delete).
   * @param id The ID of the register to delete.
   * @returns The updated register record.
   */
  async deleteRegister(id: string) {
    return this.prisma.cashRegister.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
