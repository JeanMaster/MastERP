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
        // Verificar que no haya otra sesión abierta en ESTA caja
        const activeSession = await this.prisma.cashSession.findFirst({
            where: {
                registerId: openSessionDto.registerId,
                status: { in: ['OPEN', 'AWAITING_CLOSE'] }
            }
        });

        if (activeSession) {
            throw new BadRequestException('Ya existe una sesión abierta para esta caja');
        }

        // Verificar que el cajero no tenga otra sesión abierta en ninguna caja
        if (openSessionDto.cashierId) {
            const cashierSession = await this.prisma.cashSession.findFirst({
                where: {
                    cashierId: openSessionDto.cashierId,
                    status: { in: ['OPEN', 'AWAITING_CLOSE'] }
                }
            });

            if (cashierSession) {
                throw new BadRequestException(`El cajero ${openSessionDto.cashierId} ya tiene una sesión abierta en otra caja.`);
            }
        }

        // Calcular balance inicial si se proporcionan items
        let openingBalance = openSessionDto.openingBalance || 0;
        if (openSessionDto.items && openSessionDto.items.length > 0) {
            openingBalance = 0;
            const rate = openSessionDto.exchangeRate || 1;
            for (const item of openSessionDto.items) {
                const denom = await this.prisma.currencyDenomination.findUnique({
                    where: { id: item.denominationId }
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

        // Crear nueva sesión
        const session = await this.prisma.cashSession.create({
            data: {
                registerId: openSessionDto.registerId,
                openingBalance: openingBalance,
                openedBy: openSessionDto.openedBy || 'Sistema',
                cashierId: openSessionDto.cashierId,
                openingNotes: openSessionDto.openingNotes,
                openedAt: new Date(),
                verifiedAt: openSessionDto.items ? new Date() : null,
                verifiedBy: openSessionDto.items ? (openSessionDto.openedBy || 'Sistema') : null,
                verificationDiff: openSessionDto.items ? 0 : null
            },
            include: {
                register: true
            }
        });

        // Guardar desglose si se proporcionó
        if (openSessionDto.items && openSessionDto.items.length > 0) {
            await this.saveCashCounts(session.id, 'VERIFICATION', openSessionDto.items);
        }

        // Crear movimiento de apertura
        await this.createMovement({
            sessionId: session.id,
            type: MovementType.OPENING,
            amount: openingBalance,
            currencyCode: 'VES',
            description: 'Apertura de caja',
            performedBy: openSessionDto.openedBy || 'Sistema'
        });

        return session;
    }

    /**
     * Solicitar cierre de caja (Cajero)
     */
    async requestCloseSession(sessionId: string, closeSessionDto: CloseSessionDto) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: sessionId },
            include: { movements: true }
        });

        if (!session) throw new NotFoundException('Sesión no encontrada');
        if (session.status !== 'OPEN') throw new BadRequestException('La sesión no está abierta o ya está en proceso de cierre');

        const expectedBalance = this.calculateExpectedBalance(session.movements, Number(session.openingBalance));
        const variance = Number(closeSessionDto.actualBalance) - Number(expectedBalance);

        // Guardar desglose de efectivo si se proporcionó
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
            }
        });
    }

    /**
     * Aprobar cierre de caja (Administrador)
     */
    async approveCloseSession(sessionId: string, adminUser: string) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) throw new NotFoundException('Sesión no encontrada');
        if (session.status !== 'AWAITING_CLOSE') throw new BadRequestException('La sesión no está esperando cierre');

        // Crear movimiento de cierre oficial
        await this.createMovement({
            sessionId: session.id,
            type: MovementType.CLOSING,
            amount: Number(session.actualBalance || 0),
            currencyCode: 'VES',
            description: `Cierre de caja (Autorizado) - Varianza: ${Number(session.variance || 0).toFixed(2)}`,
            performedBy: adminUser
        });

        const result = await this.prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                status: 'CLOSED',
                closedBy: adminUser,
                closedAt: new Date()
            },
            include: { register: true, movements: { orderBy: { createdAt: 'asc' } } }
        });

        return result;
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

        // Crear movimiento de cierre
        await this.createMovement({
            sessionId: session.id,
            type: MovementType.CLOSING,
            amount: closeSessionDto.actualBalance,
            currencyCode: 'VES',
            description: `Cierre de caja - Varianza: ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`,
            performedBy: closeSessionDto.closedBy || 'Sistema'
        });

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

        return updatedSession;
    }

    /**
     * Calcular balance esperado (En moneda base VES)
     */
    private calculateExpectedBalance(movements: any[], openingBalance: number): number {
        let expected = Number(openingBalance);

        for (const movement of movements) {
            // El monto del movimiento ya debería estar en su moneda original
            // Se multiplica por la tasa histórica para obtener el impacto en Bs (gaveta)
            const amountInVES = Number(movement.amount) * Number(movement.exchangeRate || 1);

            switch (movement.type) {
                case 'SALE':
                case 'WITHDRAWAL':
                    expected += amountInVES;
                    break;
                case 'EXPENSE':
                case 'DEPOSIT':
                    expected -= amountInVES;
                    break;
            }
        }

        return expected;
    }

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

        // Si no se proporciona tasa de cambio, intentar buscar la tasa actual de la moneda
        let exchangeRate = createMovementDto.exchangeRate || 1;
        if (!createMovementDto.exchangeRate && createMovementDto.currencyCode && createMovementDto.currencyCode !== 'VES') {
            const currency = await this.prisma.currency.findUnique({
                where: { code: createMovementDto.currencyCode }
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
                performedBy: createMovementDto.performedBy || 'Sistema',
                saleId: createMovementDto.saleId
            }
        });
    }

    /**
     * Obtener sesión activa
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
                    orderBy: { createdAt: 'desc' }
                },
                sales: {
                    include: {
                        items: true
                    }
                },
                cashCounts: true
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
                },
                cashCounts: true
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
     * Verificar sesión (Arqueo de Apertura)
     */
    async verifySession(sessionId: string, verifyDto: any, user: string) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new NotFoundException('Sesión no encontrada');
        }

        if (session.verifiedAt) {
            throw new BadRequestException('Esta sesión ya ha sido verificada');
        }

        // Calcular total contado
        // NOTA: En una implementación real, calcularíamos esto basado en los IDs de denominacion
        // Para simplificar ahora, asumiremos que el frontend o un paso intermedio nos da el total calculado
        // O mejor: Iteramos sobre los items y consultamos la DB.

        let totalCountedVES = 0;

        for (const item of verifyDto.items) {
            const denom = await this.prisma.currencyDenomination.findUnique({
                where: { id: item.denominationId }
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

        // Guardar desglose de efectivo
        if (verifyDto.items && verifyDto.items.length > 0) {
            await this.saveCashCounts(sessionId, 'VERIFICATION', verifyDto.items);
        }

        // Actualizar sesión
        return this.prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                verifiedAt: new Date(),
                verifiedBy: user,
                verificationDiff: diff,
                openingNotes: session.openingNotes ? `${session.openingNotes} | Arqueo OK: ${diff.toFixed(2)}` : `Arqueo OK: ${diff.toFixed(2)}`
            }
        });
    }

    /**
     * Guardar desglose de efectivo (Billetes/Monedas)
     */
    private async saveCashCounts(sessionId: string, type: 'VERIFICATION' | 'CLOSING', items: any[]) {
        // Limpiar desgloses previos del mismo tipo (si existen) para evitar duplicados en reintentos
        await this.prisma.sessionCashCount.deleteMany({
            where: {
                sessionId,
                type
            }
        });

        // Guardar nuevos items
        for (const item of items) {
            const denom = await this.prisma.currencyDenomination.findUnique({
                where: { id: item.denominationId }
            });

            if (denom) {
                await this.prisma.sessionCashCount.create({
                    data: {
                        sessionId,
                        type,
                        currencyCode: denom.currencyCode,
                        value: denom.value,
                        quantity: item.quantity,
                        total: Number(denom.value) * item.quantity
                    }
                });
            }
        }
    }

    /**
     * Obtener denominaciones activas
     */
    async getDenominations() {
        return this.prisma.currencyDenomination.findMany({
            where: { active: true },
            orderBy: { value: 'desc' }
        });
    }

    // Existing methods...
    transferToTreasury(sessionId: string, bankAccountId: string, amount: number, description: string, performedBy: string) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Verificar sesión abierta
            const session = await tx.cashSession.findUnique({
                where: { id: sessionId }
            });

            if (!session || session.status === 'CLOSED') {
                throw new BadRequestException('La sesión de caja debe estar abierta para realizar un traslado');
            }

            // 2. Obtener información de la cuenta bancaria para saber su moneda
            const bankAccount = await tx.bankAccount.findUnique({
                where: { id: bankAccountId },
                include: { currency: true }
            });

            if (!bankAccount) {
                throw new NotFoundException('Cuenta bancaria no encontrada');
            }

            // 3. Obtener la tasa de cambio actual si es una transferencia en divisa
            let exchangeRate = 1;
            if (bankAccount.currency.code !== 'VES') {
                exchangeRate = Number(bankAccount.currency.exchangeRate);
            }

            // 4. Crear movimiento de EGRESO en Caja (Restar de la gaveta)
            // Se registra el monto original de la moneda y la tasa para que expectedBalance reste bien
            await tx.cashMovement.create({
                data: {
                    sessionId,
                    type: MovementType.DEPOSIT,
                    amount,
                    currencyCode: bankAccount.currency.code,
                    exchangeRate, // Crucial para que calculateExpectedBalance reste el equivalente en Bs
                    description: `Traslado a Tesorería: ${description} (${bankAccount.currency.code})`,
                    performedBy
                }
            });

            // 5. Crear movimiento de INGRESO en Tesorería (Sumar al banco/bóveda)
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

            // 6. Actualizar balance de la cuenta bancaria (En su moneda original)
            await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: {
                    balance: { increment: Number(amount) }
                }
            });

            return bankMovement;
        });
    }

    /**
     * Listar todas las cajas
     */
    async listRegisters() {
        const registers = await this.prisma.cashRegister.findMany({
            where: { isActive: true },
            include: {
                sessions: {
                    where: { status: { in: ['OPEN', 'AWAITING_CLOSE'] } },
                    include: { movements: true },
                    take: 1
                }
            },
            orderBy: { name: 'asc' }
        });

        // Transform to include balance and status in a simpler way
        return registers.map(r => {
            const activeSession = r.sessions[0] || null;
            let currentBalance = 0;
            if (activeSession) {
                currentBalance = this.calculateExpectedBalance(activeSession.movements, Number(activeSession.openingBalance));
            }

            return {
                ...r,
                activeSession: activeSession ? {
                    id: activeSession.id,
                    status: activeSession.status,
                    openedBy: activeSession.openedBy,
                    cashierId: activeSession.cashierId,
                    openedAt: activeSession.openedAt,
                    currentBalance
                } : null
            };
        });
    }

    /**
     * Crear nueva caja
     */
    async createRegister(data: { name: string, location?: string }) {
        return this.prisma.cashRegister.create({
            data: {
                name: data.name,
                location: data.location || 'Tienda',
                isActive: true
            }
        });
    }

    /**
     * Actualizar caja
     */
    async updateRegister(id: string, data: { name?: string, location?: string, isActive?: boolean }) {
        return this.prisma.cashRegister.update({
            where: { id },
            data
        });
    }

    /**
     * Eliminar caja (Soft delete)
     */
    async deleteRegister(id: string) {
        return this.prisma.cashRegister.update({
            where: { id },
            data: { isActive: false }
        });
    }
}

