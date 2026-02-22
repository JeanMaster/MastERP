const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            images: true
        },
        where: {
            images: {
                isEmpty: false
            }
        }
    });

    let sql = '-- Script de Recuperación de Imágenes\n';
    products.forEach(p => {
        // Escape single quotes for SQL
        const imagesStr = JSON.stringify(p.images).replace(/"/g, "'").replace('[', '{').replace(']', '}');
        sql += `UPDATE "products" SET "images" = ARRAY[${p.images.map(img => `'${img.replace(/'/g, "''")}'`).join(',')}] WHERE "id" = '${p.id}';\n`;
    });

    fs.writeFileSync('restore-images.sql', sql);
    console.log(`Generated restore-images.sql with ${products.length} updates.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
