import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function findMismatches() {
  const start = dayjs('2026-01-01').startOf('day').toDate(); // Start of year as per user context
  const end = dayjs().endOf('day').toDate();

  console.log('Searching for mismatches between Jan 1 and Now...');

  const sales = await prisma.sale.findMany({
    where: { active: true },
    include: { items: true },
  });

  let totalDiff = 0;

  sales.forEach((sale) => {
    const saleTotal = Number(sale.total);
    const itemsTotal = sale.items.reduce((s, i) => s + Number(i.total), 0);

    const diff = saleTotal - itemsTotal;

    // Tolerance for floating point (e.g. 0.01)
    if (Math.abs(diff) > 0.05) {
      console.log(
        `Mismatch Sale #${sale.id}: Sale=${saleTotal}, Items=${itemsTotal}, Diff=${diff}`,
      );
      totalDiff += diff;
    }
  });

  console.log('Total Discrepancy Found:', totalDiff);
}

findMismatches();
