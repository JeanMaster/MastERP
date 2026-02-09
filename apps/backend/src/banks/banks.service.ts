
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BanksService {
    constructor(private prisma: PrismaService) { }

    async create(createBankDto: CreateBankAccountDto) {
        const { initialBalance, ...data } = createBankDto;

        return this.prisma.bankAccount.create({
            data: {
                ...data,
                balance: initialBalance || 0,
            },
            include: {
                currency: true,
            },
        });
    }

    findAll(search?: string) {
        const where: any = { active: true };

        if (search) {
            where.OR = [
                { bankName: { contains: search, mode: 'insensitive' } },
                { holderName: { contains: search, mode: 'insensitive' } },
                { accountNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.bankAccount.findMany({
            where,
            include: {
                currency: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const bank = await this.prisma.bankAccount.findUnique({
            where: { id },
            include: { currency: true },
        });

        if (!bank) {
            throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
        }

        return bank;
    }

    async update(id: string, updateBankDto: UpdateBankAccountDto) {
        await this.findOne(id);

        return this.prisma.bankAccount.update({
            where: { id },
            data: updateBankDto,
            include: { currency: true },
        });
    }

    async addMovement(dto: any) {
        const { bankAccountId, type, amount, category, description, reference, cashSessionId } = dto;

        return this.prisma.$transaction(async (tx) => {
            // 1. Create the movement
            const movement = await tx.bankMovement.create({
                data: {
                    bankAccountId,
                    type,
                    amount,
                    category,
                    description,
                    reference,
                    cashSessionId,
                },
            });

            // 2. Update the account balance
            const adjustment = type === 'IN' ? Number(amount) : -Number(amount);

            await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: {
                    balance: { increment: adjustment }
                }
            });

            return movement;
        });
    }

    async getHistory(bankAccountId: string, limit: number = 50) {
        return this.prisma.bankMovement.findMany({
            where: { bankAccountId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.bankAccount.update({
            where: { id },
            data: { active: false },
        });
    }
}
