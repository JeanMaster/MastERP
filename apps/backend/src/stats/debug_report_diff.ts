
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function runDebug() {
    const start = dayjs().startOf('month').toDate();
    const end = dayjs().endOf('month').toDate();

    console.log('Range:', start, end);

    // 1. Sales Query (Finance Style context)
    const salesFinance = await prisma.sale.findMany({
        where: { active: true, createdAt: { gte: start } }, // Simulate default finance logic (gte start of month)
        select: { total: true }
    });

    // 2. Sales Query (Balance Style context)
    const salesBalance = await prisma.sale.findMany({
        where: { active: true, createdAt: { gte: start, lte: end } },
        select: { total: true }
    });

    const totalFinance = salesFinance.reduce((s, i) => s + Number(i.total), 0);
    const totalBalance = salesBalance.reduce((s, i) => s + Number(i.total), 0);

    console.log('Sales Finance (GTE Start):', totalFinance);
    console.log('Sales Balance (GTE Start, LTE End):', totalBalance);
    console.log('Diff Sales:', totalFinance - totalBalance);

    // 3. Returns Query
    const returnsFinance = await prisma.return.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start } },
        include: { items: true, replacementItems: true }
    });

    const returnsBalance = await prisma.return.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        include: { items: true, replacementItems: true }
    });

    const calcReturns = (rets: any[]) => {
        let retVal = 0;
        let repVal = 0;
        rets.forEach(r => {
            const rV = r.items.reduce((s: number, i: any) => s + Number(i.total), 0);
            retVal += rV;
            if (r.returnType && r.returnType.startsWith('EXCHANGE')) {
                const rP = r.replacementItems.reduce((s: number, i: any) => s + Number(i.total), 0);
                repVal += rP;
            }
        });
        return { retVal, repVal };
    };

    const finRets = calcReturns(returnsFinance);
    const balRets = calcReturns(returnsBalance);

    console.log('Returns Finance:', finRets);
    console.log('Returns Balance:', balRets);

    console.log('Net Finance:', totalFinance - finRets.retVal + finRets.repVal);
    console.log('Net Balance:', totalBalance - balRets.retVal + balRets.repVal);
}

runDebug();
