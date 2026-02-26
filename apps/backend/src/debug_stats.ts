import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- Debugging Top Products Query ---');

    // 1. Check total sales count
    const totalSales = await prisma.sale.count();
    console.log(`Total Sales in DB: ${totalSales}`);

    // 2. Check active sales count
    const activeSales = await prisma.sale.count({ where: { active: true } });
    console.log(`Active Sales in DB: ${activeSales}`);

    // 3. Check sales in last 30 days
    const start = dayjs().subtract(30, 'day').startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    console.log(`Date Range: ${start.toISOString()} to ${end.toISOString()}`);

    const recentSales = await prisma.sale.count({
      where: {
        active: true,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
    console.log(`Active Sales in last 30 days: ${recentSales}`);

    if (recentSales === 0) {
      console.log(
        '⚠️ No sales in default range. Fetching oldest and newest sale dates...',
      );
      const first = await prisma.sale.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      const last = await prisma.sale.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (first) console.log('First Sale:', first.createdAt);
      if (last) console.log('Last Sale:', last.createdAt);
    }

    // 4. Test Raw Query
    console.log('\n--- Testing Raw Query ---');
    try {
      const rawResults = await prisma.$queryRaw`
                SELECT 
                    p.id,
                    p.name,
                    SUM(si.quantity) as units,
                    SUM((si."unitPrice" - COALESCE(si.cost, 0)) * si.quantity) as profit,
                    SUM(si.total) as revenue
                FROM "sale_items" si
                JOIN "products" p ON si."productId" = p.id
                JOIN "sales" s ON si."saleId" = s.id
                WHERE s.active = true
                AND s."createdAt" >= ${start}
                AND s."createdAt" <= ${end}
                GROUP BY p.id, p.name
                LIMIT 5
            `;
      console.log('Raw Query Results:', rawResults);
    } catch (e: any) {
      console.error('❌ Raw Query Failed:', e.message);
    }
  } catch (error) {
    console.error('General Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
