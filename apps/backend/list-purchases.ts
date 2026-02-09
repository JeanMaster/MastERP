import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const purchases = await prisma.purchase.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: { total: true, currencyCode: true, exchangeRate: true, createdAt: true }
  });
  console.log('PURCHASES_JSON:' + JSON.stringify(purchases));
}
main().finally(() => prisma.$disconnect());
