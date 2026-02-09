import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('--- STARTING DB CHECK ---');
  try {
    const allPurchases = await prisma.purchase.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log('PURCHASE_COUNT:' + allPurchases.length);
    allPurchases.forEach(p => {
      console.log(`Purchase: ${p.id} | Total: ${p.total} ${p.currencyCode} | Rate: ${p.exchangeRate} | CreatedAt: ${p.createdAt}`);
    });
  } catch (err) {
    console.error('DB_ERROR:', err);
  }
}
main().finally(() => {
  console.log('--- DB CHECK FINISHED ---');
  prisma.$disconnect();
});
