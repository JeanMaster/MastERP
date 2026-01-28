import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.purchase.count();
    process.stdout.write('PURCHASE_COUNT:' + count + '\n');
}
main().catch(err => {
    process.stderr.write('ERROR:' + err.message + '\n');
}).finally(() => prisma.$disconnect());
