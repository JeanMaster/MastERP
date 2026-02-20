
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- BANK ACCOUNTS ---');
    const banks = await prisma.bankAccount.findMany({
        include: { currency: true }
    });
    console.log(JSON.stringify(banks, null, 2));

    console.log('\n--- EXPENSES ---');
    const expenses = await prisma.expense.findMany();
    console.log(JSON.stringify(expenses, null, 2));

    console.log('\n--- CURRENCIES ---');
    const currencies = await prisma.currency.findMany();
    console.log(JSON.stringify(currencies, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
