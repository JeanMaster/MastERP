import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function testInflationReport() {
    console.log('--- Testing Inflation Report Logic ---');

    // 1. Get current exchange rate for VES
    const companySettings = await prisma.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true }
    });
    const currentRate = Number(companySettings?.preferredSecondaryCurrency?.exchangeRate || 1);
    console.log(`Current Exchange Rate: ${currentRate}`);

    // 2. Fetch sales from this month
    const startDate = dayjs().startOf('month').toDate();
    const sales = await prisma.sale.findMany({
        where: { active: true, createdAt: { gte: startDate } },
        select: {
            total: true,
            paymentMethod: true,
            createdAt: true,
            exchangeRate: true
        }
    });

    console.log(`Analyzing ${sales.length} sales...`);

    let totalNominal = 0;
    let totalRevalued = 0;

    sales.forEach(sale => {
        const historicalRate = Number(sale.exchangeRate) || currentRate;
        const paymentStr = sale.paymentMethod || '';
        const payments = paymentStr.split(', ');

        payments.forEach(p => {
            const parts = p.trim().split(':');
            const method = parts[0].toUpperCase();
            const amount = Number(parts[1] || 0);

            // Simple local check for test
            const isLocal = !['ZELLE', 'UDT', 'USD'].some(m => method.includes(m));

            if (isLocal && amount > 0) {
                const revalued = (amount / historicalRate) * currentRate;
                totalNominal += amount;
                totalRevalued += revalued;
            }
        });
    });

    console.log(`Total Nominal Bs: ${totalNominal.toFixed(2)}`);
    console.log(`Total Revalued Bs: ${totalRevalued.toFixed(2)}`);
    console.log(`Estimated Inflation Loss: ${(totalRevalued - totalNominal).toFixed(2)} Bs.`);
    console.log(`Loss Percentage: ${totalRevalued > 0 ? (((totalRevalued - totalNominal) / totalRevalued) * 100).toFixed(2) : 0}%`);

    await prisma.$disconnect();
}

testInflationReport().catch(console.error);
