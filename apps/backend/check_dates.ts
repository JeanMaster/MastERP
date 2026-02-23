
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const counts = await prisma.sale.groupBy({
        by: ['createdAt'],
        _count: true
    });
    // Group by month
    const monthly: Record<string, number> = {};
    counts.forEach(c => {
        const month = c.createdAt.toISOString().slice(0, 7);
        monthly[month] = (monthly[month] || 0) + c._count;
    });
    console.log(JSON.stringify(monthly, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
