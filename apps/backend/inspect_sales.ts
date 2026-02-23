
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

function revalueSaleByPayments(sale: any, currentRefRate: number) {
    const paymentStr = sale.paymentMethod || 'CASH';
    const parts = paymentStr.split(', ');
    const saleNominalTotal = Number(sale.total);

    let totalInVES = 0;

    parts.forEach(p => {
        const subparts = p.trim().split(':');
        const method = subparts[0].trim().toUpperCase();

        let rawAmount = saleNominalTotal;
        let isExplicit = false;
        if (subparts.length > 1) {
            rawAmount = parseFloat(subparts[1]);
            isExplicit = true;
        } else if (parts.length > 1) {
            rawAmount = saleNominalTotal / parts.length;
        }

        const isForeign =
            method === 'ZELLE' ||
            method === 'UDT' ||
            method.startsWith('CURRENCY_') ||
            (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

        let paymentVES = 0;
        let paymentUSD = 0;

        if (isForeign) {
            const saleRate = Number(sale.exchangeRate) || currentRefRate;
            const expectedTotalInUSD = saleNominalTotal / saleRate;

            const isLikelyMisrepresented = rawAmount > (expectedTotalInUSD * 1.5) && rawAmount > 5;

            if (isLikelyMisrepresented && isExplicit) {
                paymentVES = rawAmount;
                paymentUSD = rawAmount / currentRefRate;
            } else {
                paymentUSD = rawAmount;
                paymentVES = rawAmount * currentRefRate;
            }
        } else {
            paymentVES = rawAmount;
            paymentUSD = rawAmount / currentRefRate;
        }

        totalInVES += paymentVES;
    });

    return totalInVES;
}

async function main() {
    const currentRefRate = 40.5; // Estimated
    const sales = await prisma.sale.findMany({
        where: {
            createdAt: {
                gte: dayjs('2026-02-01').toDate(),
                lte: dayjs('2026-02-28').toDate(),
            },
            active: true
        },
    });

    console.log(`Analyzing ${sales.length} sales from February 2026...`);

    let totalNominal = 0;
    let totalRevaluedNew = 0;

    for (const sale of sales) {
        const nominal = Number(sale.total);
        const revalued = revalueSaleByPayments(sale, currentRefRate);

        totalNominal += nominal;
        totalRevaluedNew += revalued;

        if (revalued > nominal * 1.5) {
            console.log(`Inflation Case: ID=${sale.id}, Total=${nominal}, Revalued=${revalued.toFixed(2)}, Method=${sale.paymentMethod}`);
        }
    }

    console.log(`\nSummary:`);
    console.log(`Total Nominal: ${totalNominal.toFixed(2)}`);
    console.log(`Total Revalued Key (New Logic): ${totalRevaluedNew.toFixed(2)}`);
    console.log(`Inflation Factor: ${(totalRevaluedNew / totalNominal).toFixed(2)}x`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
