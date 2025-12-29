
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function getBalanceReport(currencyCode: string = 'VES') {
    console.log(`\n📊 Generating Report for CURRENCY: ${currencyCode}`);

    // Test for last 6 months
    const now = dayjs();
    const start = now.subtract(6, 'month').startOf('month').toDate();
    const end = now.endOf('month').toDate();

    console.log(`📅 Date Range: ${start.toISOString()} - ${end.toISOString()}`);

    const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end }, active: true },
        select: { total: true, exchangeRate: true }
    });

    console.log(`✅ Found ${sales.length} sales`);

    // Log a few samples
    if (sales.length > 0) {
        console.log('Sample Sale:', sales[0]);
    }

    let monthlyIncome = 0;

    sales.forEach(sale => {
        let amount = Number(sale.total);
        if (currencyCode !== 'VES') {
            const rate = Number(sale.exchangeRate) || 1;
            // console.log(`   Converting ${amount} VES using rate ${rate} -> ${amount/rate}`);
            amount = amount / rate;
        }
        monthlyIncome += amount;
    });

    console.log(`💰 Total Income (${currencyCode}): ${monthlyIncome.toFixed(2)}`);
    return monthlyIncome;
}

async function main() {
    const vesIncome = await getBalanceReport('VES');
    const usdIncome = await getBalanceReport('USD');

    if (vesIncome === usdIncome) {
        console.error('❌ ERROR: Income is identical for VES and USD! Logic is failing.');
    } else {
        console.log('✅ SUCCESS: Logic is working correctly. Values differ.');
        console.log(`   VES: ${vesIncome.toFixed(2)}`);
        console.log(`   USD: ${usdIncome.toFixed(2)}`);
        console.log(`   Implied Rate: ${(vesIncome / usdIncome).toFixed(2)}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
