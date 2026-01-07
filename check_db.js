
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const currencies = await prisma.currency.findMany({
        where: { active: true },
        select: { id: true, name: true, code: true, isAutomatic: true, exchangeRate: true }
    });
    console.log(JSON.stringify(currencies, null, 2));

    const settings = await prisma.companySettings.findFirst();
    console.log('Settings:', JSON.stringify(settings, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
