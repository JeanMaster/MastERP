const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const prisma = new PrismaClient();

async function main() {
  const start = dayjs().startOf('month').toDate();
  const end = dayjs().endOf('month').toDate();
  
  const purchases = await prisma.purchase.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { id: true, total: true, currencyCode: true, exchangeRate: true, createdAt: true }
  });

  const settings = await prisma.companySettings.findFirst({
    include: { preferredSecondaryCurrency: true }
  });
  const currentRefRate = Number(settings?.preferredSecondaryCurrency?.exchangeRate || 1);

  console.log('--- PURCHASES THIS MONTH ---');
  let totalUSDReal = 0;
  
  purchases.forEach(p => {
    const total = Number(p.total);
    const rate = Number(p.exchangeRate) || 1;
    const valInVES = p.currencyCode === 'VES' ? total : total * rate;
    
    // We want the Real USD value at the time (Historical)
    // If it was in USD, val / 1 = USD.
    // If it was in UDT (600), val * 600 = VES. Then VES / 340 (USD rate then) = USD.
    // However, our code uses (valInVES / historicalRate) where historicalRate is the rate OF THE PURCHASE.
    
    const historicalRate = (rate !== 1) ? rate : currentRefRate;
    const valInUSD = valInVES / historicalRate;
    
    totalUSDReal += valInUSD;
    console.log(`ID: ${p.id.slice(0,8)} | ${total} ${p.currencyCode} | Rate: ${rate} | USD: ${valInUSD.toFixed(2)}`);
  });

  console.log('----------------------------');
  console.log(`Total USD Hist: ${totalUSDReal.toFixed(2)}`);
  console.log(`Current Rate: ${currentRefRate}`);
  console.log(`Total Adjusted VES: ${(totalUSDReal * currentRefRate).toFixed(2)}`);
}

main().finally(() => prisma.$disconnect());
