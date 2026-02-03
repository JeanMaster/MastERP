
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function compareTimeRanges() {
    const now = dayjs();

    // 1. "All Time" (Simulated COGS 'Todo')
    const allSales = await prisma.sale.findMany({
        where: { active: true },
        select: { total: true, createdAt: true }
    });
    const totalAll = allSales.reduce((s, i) => s + Number(i.total), 0);

    // 2. "Last 12 Months" (Simulated Balance)
    let total12M = 0;
    for (let i = 11; i >= 0; i--) {
        const currentMonth = now.subtract(i, 'month');
        const start = currentMonth.startOf('month').toDate();
        const end = currentMonth.endOf('month').toDate();

        const monthSales = await prisma.sale.findMany({
            where: {
                active: true,
                createdAt: { gte: start, lte: end }
            },
            select: { total: true }
        });
        const mTotal = monthSales.reduce((s, i) => s + Number(i.total), 0);
        total12M += mTotal;
    }

    console.log('Total All Time Sales:', totalAll);
    console.log('Total 12 Months Sales:', total12M);
    console.log('Difference:', totalAll - total12M);

    if (Math.abs(totalAll - total12M) > 0.1) {
        console.log('Finding missing transactions...');
        // Find transactions not in the 12 month buckets
        const start12M = now.subtract(11, 'month').startOf('month').toDate();
        const missing = allSales.filter(s => s.createdAt < start12M || s.createdAt > now.endOf('month').toDate()); // Usually > is impossible if future

        missing.forEach(s => {
            console.log(`Missing Sale #${s.createdAt}: ${s.total}`);
        });

        // Also check for gaps between months (unlikely with startOf/endOf month but possible with ms precision gaps?)
        // dayjs startOf('month') is 00:00:00.000
        // endOf('month') is 23:59:59.999
        // Are there gap ms? No, usually prisma handles GTE/LTE fine.
    }
}

compareTimeRanges();
