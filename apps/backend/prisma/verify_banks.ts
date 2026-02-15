
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Bank Accounts ---');
    const banks = await prisma.bankAccount.findMany({
        include: { currency: true }
    });
    console.log(`Found ${banks.length} bank accounts:`);
    banks.forEach(b => {
        console.log(`- ${b.bankName} (${b.accountNumber}) | Currency: ${b.currency?.code} | Active: ${b.active}`);
    });

    console.log('\n--- Checking Currencies ---');
    const currencies = await prisma.currency.findMany();
    currencies.forEach(c => {
        console.log(`- ${c.name} (${c.code}) | ID: ${c.id}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
