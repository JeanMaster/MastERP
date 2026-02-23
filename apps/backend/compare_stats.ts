import { PrismaClient } from '@prisma/client';
import { StatsService } from './src/stats/stats.service';
import dayjs from 'dayjs';

async function main() {
    const prisma = new PrismaClient();
    // @ts-ignore
    const statsService = new StatsService(prisma);

    const start = '2026-01-01';
    const end = '2026-01-31';
    console.log(`--- Comparing stats for ${start} to ${end} ---\n`);

    const dashboard = await statsService.getDashboardStats('30days'); // range doesn't matter for thisMonthSales
    console.log('--- Dashboard Stats ---');
    console.log(`thisMonthSales (Revalued): ${dashboard.thisMonthSales}`);
    console.log(`thisMonthSalesNominal: ${dashboard.thisMonthSalesNominal}`);
    console.log(`monthReturns:`, JSON.stringify(dashboard.monthReturns, null, 2));

    const finance = await statsService.getFinanceReport('VES', start, end);
    console.log('\n--- Finance Report (VES) ---');
    console.log(`monthlySalesTotal (Revalued): ${finance.monthlySalesTotal}`);
    console.log(`monthlySalesNominal: ${finance.monthlySalesNominal}`);
    console.log(`totalMonetaryRefunds: ${finance.totalMonetaryRefunds}`);
    console.log(`totalExchangeValue: ${finance.totalExchangeValue}`);

    await prisma.$disconnect();
}

main().catch(console.error);
