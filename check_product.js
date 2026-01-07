
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const product = await prisma.product.findFirst({
        where: { name: { contains: 'CORREA M - 24' } },
        include: { currency: true }
    });
    console.log(JSON.stringify(product, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
