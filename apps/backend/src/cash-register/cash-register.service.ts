import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateMovementDto, MovementType } from './dto/create-movement.dto';

@Injectable()
export class CashRegisterService {
    constructor(private prisma: PrismaService) { }

    /**
     * Obtener o crear caja principal
     */
    async getOrCreateMainRegister() {
        let register = await this.prisma.cashRegister.findFirst({
            where: { isActive: true }
        });

        if (!register) {
            register = await this.prisma.cashRegister.create({
                data: {
                    name: 'Caja Principal',
                    location: 'Tienda'
                }
            });
        }

        return register;
    }

    /**
     * Abrir sesión de caja
     */
    async openSession(openSessionDto: OpenSessionDto) {
        // Verificar que no haya otra sesión abierta
        const activeSession = await this.prisma.cashSession.findFirst({
            where: {
                registerId: openSessionDto.registerId,
                status: 'OPEN'
            }
        });

        if (activeSession) {
            throw new BadRequestException('Ya existe una sesión abierta para esta caja');
        }

        // Crear nueva sesión
        const session = await this.prisma.cashSession.create({
            data: {
                registerId: openSessionDto.registerId,
                openingBalance: openSessionDto.openingBalance,
                openedBy: openSessionDto.openedBy || 'Sistema',
                openingNotes: openSessionDto.openingNotes,
                openedAt: new Date() // Explicitly set to server (UTC) time
            },
            include: {
                register: true
            }
        });

        // Crear movimiento de apertura
        await this.createMovement({
            sessionId: session.id,
            type: MovementType.OPENING,
            amount: openSessionDto.openingBalance,
            currencyCode: 'VES',
            description: 'Apertura de caja',
            performedBy: openSessionDto.openedBy || 'Sistema'
        });

        return session;
    }

    /**
     * Cerrar sesión de caja
     */
    async closeSession(sessionId: string, closeSessionDto: CloseSessionDto) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: sessionId },
            include: {
                movements: true
            }
        });

        if (!session) {
            throw new NotFoundException('Sesión no encontrada');
        }

        if (session.status === 'CLOSED') {
            throw new BadRequestException('La sesión ya está cerrada');
        }

        // Calcular balance esperado
        const expectedBalance = this.calculateExpectedBalance(session.movements, Number(session.openingBalance));

        // Calcular varianza
        const variance = Number(closeSessionDto.actualBalance) - Number(expectedBalance);

        // Actualizar sesión
        const updatedSession = await this.prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                status: 'CLOSED',
                closedBy: closeSessionDto.closedBy || 'Sistema',
                closedAt: new Date(),
                expectedBalance,
                actualBalance: closeSessionDto.actualBalance,
                variance,
                closingNotes: closeSessionDto.closingNotes
            },
            include: {
                register: true,
                movements: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        // Crear movimiento de cierre
        await this.createMovement({
            sessionId: session.id,
            type: MovementType.CLOSING,
            amount: closeSessionDto.actualBalance,
            currencyCode: 'VES',
            description: `Cierre de caja - Varianza: ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`,
            performedBy: closeSessionDto.closedBy || 'Sistema'
        });

        return updatedSession;
    }

    /**
     * Calcular balance esperado
     */
    private calculateExpectedBalance(movements: any[], openingBalance: number): number {
        let expected = Number(openingBalance);

        for (const movement of movements) {
            const amount = Number(movement.amount);

            switch (movement.type) {
                case 'SALE':
                case 'WITHDRAWAL':
                    expected += amount;
                    break;
                case 'EXPENSE':
                case 'DEPOSIT':
                    expected -= amount;
                    break;
            }
        }

        return expected;
    }

    /**
     * Crear movimiento de caja
     */
    async createMovement(createMovementDto: CreateMovementDto) {
        // Verificar que la sesión existe y está abierta
        const session = await this.prisma.cashSession.findUnique({
            where: { id: createMovementDto.sessionId }
        });

        if (!session) {
            throw new NotFoundException('Sesión no encontrada');
        }

        if (session.status === 'CLOSED') {
            throw new BadRequestException('No se pueden agregar movimientos a una sesión cerrada');
        }

        return this.prisma.cashMovement.create({
            data: {
                sessionId: createMovementDto.sessionId,
                type: createMovementDto.type,
                amount: createMovementDto.amount,
                currencyCode: createMovementDto.currencyCode || 'VES',
                description: createMovementDto.description,
                notes: createMovementDto.notes,
                performedBy: createMovementDto.performedBy || 'Sistema',
                saleId: createMovementDto.saleId
            }
        });
    }

    /**
     * Obtener sesión activa
     */
    async getActiveSession(registerId?: string) {
        const where: any = { status: 'OPEN' };
        if (registerId) {
            where.registerId = registerId;
        }

        return this.prisma.cashSession.findFirst({
            where,
            include: {
                register: true,
                movements: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    }

    /**
     * Obtener sesión por ID
     */
    async getSession(id: string) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id },
            include: {
                register: true,
                movements: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        sale: true
                    }
                }
            }
        });

        if (!session) {
            throw new NotFoundException('Sesión no encontrada');
        }

        return session;
    }

    /**
     * Listar sesiones
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
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { openedAt: 'desc' }
        });
    }

    /**
     * Trasladar fondos de Caja a Tesorería
     */
    async transferToTreasury(sessionId: string, bankAccountId: string, amount: number, description: string, performedBy: string) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Verificar sesión abierta
            const session = await tx.cashSession.findUnique({
                where: { id: sessionId }
            });

            if (!session || session.status === 'CLOSED') {
                throw new BadRequestException('La sesión de caja debe estar abierta para realizar un traslado');
            }

            // 2. Crear movimiento de EGRESO en Caja (Restar de la gaveta)
            // Según la lógica actual, DEPOSIT resta del balance de caja (significa "salida para depósito")
            await tx.cashMovement.create({
                data: {
                    sessionId,
                    type: MovementType.DEPOSIT,
                    amount,
                    currencyCode: 'VES', // O la moneda de la caja
                    description: `Traslado a Tesorería: ${description}`,
                    performedBy
                }
            });

            // 3. Crear movimiento de INGRESO en Tesorería (Sumar al banco/bóveda)
            const bankMovement = await tx.bankMovement.create({
                data: {
                    bankAccountId,
                    type: 'IN',
                    amount,
                    category: 'SALE_TRANSFER',
                    description: `Traslado desde Caja: ${description}`,
                    cashSessionId: sessionId
                }
            });

            // 4. Actualizar balance de la cuenta bancaria
            await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: {
                    balance: { increment: Number(amount) }
                }
            });

            return bankMovement;
        });
    }
}
