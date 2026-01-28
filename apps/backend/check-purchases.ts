import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const start = dayjs().startOf('month').toDate();
    const end = dayjs().endOf('month').toDate();

    const purchases = await prisma.purchase.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      },
      select: {
        total: true,
        currencyCode: true,
        exchangeRate: true,
        createdAt: true
      }
    });

    console.log('PURCHASE_COUNT:' + purchases.length);
    let totalVESNominal = 0;

    purchases.forEach(p => {
      const total = Number(p.total);
      const rate = Number(p.exchangeRate) || 1;
      const valInVES = p.currencyCode === 'VES' ? total : total * rate;
      totalVESNominal += valInVES;
    });

    console.log('TOTAL_VES_NOMINAL:' + totalVESNominal);
    
    const settings = await prisma.companySettings.findFirst({
        include: { preferredSecondaryCurrency: true }
    });
    console.log('REF_RATE:' + (settings?.preferredSecondaryCurrency?.exchangeRate || 1));

  } catch (e) {
    console.error(e);
  }
}

main().finally(() => prisma.$disconnect());
