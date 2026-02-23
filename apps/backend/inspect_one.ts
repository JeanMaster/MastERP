
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sale = await prisma.sale.findUnique({
        where: { id: '5888a3e7-a4c2-4c64-a865-80559f212ecf' },
        include: { items: true }
    });
    console.log(JSON.stringify(sale, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
