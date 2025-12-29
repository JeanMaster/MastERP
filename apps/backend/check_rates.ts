
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Exchange Rates in Sales ---');
    const sales = await prisma.sale.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            total: true,
            exchangeRate: true,
            createdAt: true
        }
    });

    console.table(sales);

    console.log('--- Checking Exchange Rate Distribution ---');
    const distinctRates = await prisma.sale.groupBy({
        by: ['exchangeRate'],
        _count: true
    });
    console.table(distinctRates);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
