
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const sale = await prisma.sale.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        if (sale) {
            console.log('Latest Sale Invoice:', sale.invoiceNumber);
            console.log('Payment Method:', sale.paymentMethod);
            if (sale.paymentMethod.includes('MOBILE')) {
                console.log('Contains MOBILE');
                const parts = sale.paymentMethod.split(':');
                console.log('Parts:', parts);
                if (parts.length > 2) {
                    console.log('Bank ID found:', parts[2]);

                    // Check if bank movement exists
                    const mv = await prisma.bankMovement.findFirst({
                        where: { reference: `PM-${sale.invoiceNumber}` }
                    });
                    console.log('Bank Movement:', mv);
                } else {
                    console.log('No Bank ID in string');
                }
            }
        } else {
            console.log('No sales found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
