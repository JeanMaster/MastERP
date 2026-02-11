
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Currency Denominations...');

    const denominations = [
        // VES
        { currencyCode: 'VES', value: 500.00, label: '500 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 200.00, label: '200 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 100.00, label: '100 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 50.00, label: '50 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 20.00, label: '20 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 10.00, label: '10 Bolívares', type: 'BILL' },
        { currencyCode: 'VES', value: 5.00, label: '5 Bolívares', type: 'BILL' },

        // USD
        { currencyCode: 'USD', value: 100.00, label: '100 Dólares', type: 'BILL' },
        { currencyCode: 'USD', value: 50.00, label: '50 Dólares', type: 'BILL' },
        { currencyCode: 'USD', value: 20.00, label: '20 Dólares', type: 'BILL' },
        { currencyCode: 'USD', value: 10.00, label: '10 Dólares', type: 'BILL' },
        { currencyCode: 'USD', value: 5.00, label: '5 Dólares', type: 'BILL' },
        { currencyCode: 'USD', value: 1.00, label: '1 Dólar', type: 'BILL' },
    ];

    for (const d of denominations) {
        // Use upsert or findFirst to avoid duplicates if re-running
        const exists = await prisma.currencyDenomination.findFirst({
            where: { currencyCode: d.currencyCode, value: d.value }
        });

        if (!exists) {
            await prisma.currencyDenomination.create({ data: d });
            console.log(`Created: ${d.label}`);
        } else {
            console.log(`Exists: ${d.label}`);
        }
    }

    console.log('✅ Denominations seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
