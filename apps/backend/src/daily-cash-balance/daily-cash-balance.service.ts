import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDailyCashBalanceDto } from './dto/upsert-daily-cash-balance.dto';

@Injectable()
export class DailyCashBalanceService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: UpsertDailyCashBalanceDto) {
    const day = dayjs(dto.date).startOf('day').toDate();
    return this.prisma.dailyCashBalance.upsert({
      where: { date: day },
      create: { date: day, balance: dto.balance, notes: dto.notes },
      update: { balance: dto.balance, notes: dto.notes },
    });
  }

  async findAll(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) where.date.lte = dayjs(endDate).endOf('day').toDate();
    }
    return this.prisma.dailyCashBalance.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async findToday() {
    const day = dayjs().startOf('day').toDate();
    return this.prisma.dailyCashBalance.findUnique({ where: { date: day } });
  }

  /**
   * Measures real day-over-day inflation loss on the Bs balance the user
   * actually reported at closing each day — not an estimate. Requires at
   * least two snapshots to compute a transition.
   */
  async getInflationImpact(startDate?: string, endDate?: string) {
    const snapshots = await this.findAll(startDate, endDate);

    if (snapshots.length < 2) {
      return {
        hasEnoughData: false,
        daysCovered: snapshots.length,
        totalLoss: 0,
        transitions: [],
      };
    }

    const rangeStart = dayjs(snapshots[0].date).subtract(3, 'day').toDate();
    const rangeEnd = dayjs(snapshots[snapshots.length - 1].date)
      .add(1, 'day')
      .toDate();

    const [sales, vesExpenses, companySettings] = await Promise.all([
      this.prisma.sale.findMany({
        where: { active: true, date: { gte: rangeStart, lte: rangeEnd } },
        select: { date: true, exchangeRate: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: {
          currencyCode: 'VES',
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { date: true, exchangeRate: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true },
      }),
    ]);

    // Last known rate per calendar day, from whichever transaction happened
    // that day (sales take precedence, they're the most frequent signal).
    const rateByDay: Record<string, number> = {};
    [...vesExpenses, ...sales].forEach((row) => {
      const key = dayjs(row.date).format('YYYY-MM-DD');
      const rate = Number(row.exchangeRate);
      if (rate > 0) rateByDay[key] = rate;
    });

    const knownDays = Object.keys(rateByDay).sort();
    const fallbackRate = Number(
      companySettings?.preferredSecondaryCurrency?.exchangeRate || 1,
    );

    const getRateForDay = (date: Date): number => {
      const key = dayjs(date).format('YYYY-MM-DD');
      if (rateByDay[key]) return rateByDay[key];
      // Nearest earlier day with a known rate.
      for (let i = knownDays.length - 1; i >= 0; i--) {
        if (knownDays[i] <= key) return rateByDay[knownDays[i]];
      }
      return fallbackRate;
    };

    let totalLoss = 0;
    const transitions: {
      fromDate: string;
      toDate: string;
      balance: number;
      rateFrom: number;
      rateTo: number;
      loss: number;
    }[] = [];

    for (let i = 0; i < snapshots.length - 1; i++) {
      const from = snapshots[i];
      const to = snapshots[i + 1];
      const rateFrom = getRateForDay(from.date);
      const rateTo = getRateForDay(to.date);
      const balance = Number(from.balance);

      // How many more Bs it would take at the next rate to hold the same
      // purchasing power this balance had the day it was reported.
      const loss = (balance / rateFrom) * rateTo - balance;
      totalLoss += loss;

      transitions.push({
        fromDate: dayjs(from.date).format('YYYY-MM-DD'),
        toDate: dayjs(to.date).format('YYYY-MM-DD'),
        balance,
        rateFrom,
        rateTo,
        loss,
      });
    }

    return {
      hasEnoughData: true,
      daysCovered: snapshots.length,
      totalLoss,
      transitions,
    };
  }
}
