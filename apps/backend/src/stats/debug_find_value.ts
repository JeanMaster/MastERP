
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findValue() {
    const target = 839.38;
    const tolerance = 1.0; // +/- 1 Bs

    console.log(`Searching for value ~${target}...`);

    // 1. Sale Totals
    const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: new Date('2025-01-01') } }, // Optimization
        select: { id: true, total: true, createdAt: true }
    });
    sales.forEach(s => {
        if (Math.abs(Number(s.total) - target) < tolerance) {
            console.log(`Found Sale #${s.id} (${s.createdAt}): ${s.total}`);
        }
    });

    // 2. Return Items
    const returns = await prisma.return.findMany({
        where: { createdAt: { gte: new Date('2025-01-01') } },
        include: { items: true, replacementItems: true }
    });

    returns.forEach(r => {
        // Check items sum
        const retSum = r.items.reduce((a, b) => a + Number(b.total), 0);
        if (Math.abs(retSum - target) < tolerance) {
            console.log(`Found Return #${r.id} sum (${r.createdAt}): ${retSum}`);
        }

        // Check replacement sum
        const repSum = r.replacementItems.reduce((a, b) => a + Number(b.total), 0);
        if (Math.abs(repSum - target) < tolerance) {
            console.log(`Found Return Replacement #${r.id} sum (${r.createdAt}): ${repSum}`);
        }

        // Check Refund Amount
        if (r.refundAmount && Math.abs(Number(r.refundAmount) - target) < tolerance) {
            console.log(`Found Refund Amount #${r.id} (${r.createdAt}): ${r.refundAmount}`);
        }
    });
}

findValue();
