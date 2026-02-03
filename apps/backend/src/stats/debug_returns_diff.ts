
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function checkReturns() {
    const now = dayjs();

    // 1. All Time Returns
    const allReturns = await prisma.return.findMany({
        where: { status: 'COMPLETED' },
        include: { items: true, replacementItems: true }
    });

    // Net Impact = Sum(Returned Items) - Sum(Replacement Items)
    // This represents the value subtracted from Sales.
    let impactAll = 0;
    allReturns.forEach(r => {
        const retVal = r.items.reduce((s, i) => s + Number(i.total), 0);
        let repVal = 0;
        if (r.returnType && r.returnType.startsWith('EXCHANGE')) {
            repVal = r.replacementItems.reduce((s, i) => s + Number(i.total), 0);
        }
        impactAll += (retVal - repVal);
    });

    // 2. 12 Month Loop Returns
    let impact12M = 0;

    for (let i = 11; i >= 0; i--) {
        const currentMonth = now.subtract(i, 'month');
        const start = currentMonth.startOf('month').toDate();
        const end = currentMonth.endOf('month').toDate();

        const monthReturns = await prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: { gte: start, lte: end }
            },
            include: { items: true, replacementItems: true }
        });

        monthReturns.forEach(r => {
            const retVal = r.items.reduce((s, i) => s + Number(i.total), 0);
            let repVal = 0;
            if (r.returnType && r.returnType.startsWith('EXCHANGE')) {
                repVal = r.replacementItems.reduce((s, i) => s + Number(i.total), 0);
            }
            impact12M += (retVal - repVal);
        });
    }

    console.log('Net Return Impact All Time:', impactAll);
    console.log('Net Return Impact 12 Months:', impact12M);
    console.log('Difference:', impactAll - impact12M);
}

checkReturns();
