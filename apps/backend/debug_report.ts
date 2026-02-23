import { PrismaClient } from '@prisma/client';
import { StatsService } from './src/stats/stats.service';
import { PrismaService } from './src/prisma/prisma.service';
import dayjs from 'dayjs';

async function main() {
    const prisma = new PrismaClient();
    // @ts-ignore
    const statsService = new StatsService(prisma);

    const start = '2026-02-01';
    const end = dayjs().format('YYYY-MM-DD');
    console.log(`--- Report for ${start} to ${end} ---`);

    console.log('\n--- Finance Report (VES) ---');
    const financeVES = await statsService.getFinanceReport('VES', start, end);
    console.log(`Monthly Sales Total (Revalued): ${financeVES.monthlySalesTotal}`);
    console.log(`Monthly Sales Nominal: ${financeVES.monthlySalesNominal}`);

    console.log('\n--- Finance Report (USD) ---');
    const financeUSD = await statsService.getFinanceReport('USD', start, end);
    console.log(`Monthly Sales Total (Revalued): ${financeUSD.monthlySalesTotal}`);
    console.log(`Monthly Sales Nominal: ${financeUSD.monthlySalesNominal}`);

    console.log('\n--- Payment Breakdown (VES) ---');
    financeVES.paymentMethodsBreakdown.forEach((p: any) => {
        console.log(`${p.method}: ${p.amount}`);
    });

    console.log('\n--- COGS Report (VES) ---');
    const cogsVES = await statsService.getCOGSReport('VES', start, end);
    console.log(`Total Sales: ${cogsVES.totalSales}`);
    console.log(`Total COGS: ${cogsVES.totalCOGS}`);
    console.log(`Gross Profit: ${cogsVES.grossProfit}`);

    await prisma.$disconnect();
}

main().catch(console.error);
