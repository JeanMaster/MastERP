const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            name: true,
            images: true
        },
        where: {
            images: {
                isEmpty: false
            }
        },
        take: 10
    });

    console.log('Products with images:', JSON.stringify(products, null, 2));

    const totalWithImages = await prisma.product.count({
        where: {
            images: {
                isEmpty: false
            }
        }
    });

    const totalProducts = await prisma.product.count();

    console.log(`Total products: ${totalProducts}`);
    console.log(`Products with images in array: ${totalWithImages}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
