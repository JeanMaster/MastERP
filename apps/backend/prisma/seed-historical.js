const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Iniciando carga de datos históricos (Modo JS)...');

    // Asegurar monedas
    const usd = await prisma.currency.upsert({
        where: { code: 'USD' },
        update: {},
        create: { name: 'Dólar Estadounidense', code: 'USD', symbol: '$', exchangeRate: 60.00 }
    });

    const ves = await prisma.currency.upsert({
        where: { code: 'VES' },
        update: {},
        create: { name: 'Bolívares', code: 'VES', symbol: 'Bs.', isPrimary: true, exchangeRate: 1 }
    });

    // Asegurar Departamento y Unidad
    const deptGeneral = await prisma.department.upsert({
        where: { id: 'general-dept' },
        update: {},
        create: { id: 'general-dept', name: 'General' }
    });

    const unitPza = await prisma.unit.upsert({
        where: { name: 'Pieza' },
        update: {},
        create: { name: 'Pieza', abbreviation: 'Pza' }
    });

    // Clientes
    console.log('👥 Creando clientes...');
    const clients = [
        { id: 'V-10203040', name: 'Juan Pérez', phone: '04121112233', hasWhatsapp: true, email: 'juan@perez.com' },
        { id: 'V-50607080', name: 'Maria Rodriguez', phone: '04245556677', hasWhatsapp: true },
        { id: 'J-12345678-9', name: 'TecnoSistemas C.A.', phone: '02129998877', email: 'contacto@tecno.com' },
    ];

    for (const c of clients) {
        await prisma.client.upsert({ where: { id: c.id }, update: {}, create: c });
    }

    // Productos
    console.log('📦 Creando productos...');
    const products = [
        { sku: 'LAP-001', name: 'Laptop Dell XPS 13', salePrice: 1200, costPrice: 900 },
        { sku: 'MOU-002', name: 'Mouse Logitech MX Master', salePrice: 100, costPrice: 60 },
        { sku: 'MON-003', name: 'Monitor LG 27" 4K', salePrice: 450, costPrice: 320 },
        { sku: 'KEY-004', name: 'Teclado Mecánico', salePrice: 80, costPrice: 45 },
    ];

    const createdProducts = [];
    for (const p of products) {
        const cp = await prisma.product.upsert({
            where: { sku: p.sku },
            update: {},
            create: {
                sku: p.sku,
                name: p.name,
                salePrice: p.salePrice,
                costPrice: p.costPrice,
                categoryId: deptGeneral.id,
                currencyId: usd.id,
                stock: 50,
                unitId: unitPza.id
            }
        });
        createdProducts.push(cp);
    }

    // Ventas (6 meses)
    console.log('💰 Generando ventas históricas...');
    const now = new Date();
    let counter = 3000;

    // Simulate exchange rate from 6 months ago (35) to now (60)
    const startRate = 35;
    const endRate = 60;
    const rateStep = (endRate - startRate) / 180;

    for (let i = 0; i < 180; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);

        // Calculate daily rate (linear progression)
        // i=0 is today (max rate), i=180 is 6 months ago (min rate)
        // Rate = EndRate - (Step * i)
        const currentRate = endRate - (rateStep * i);

        const count = Math.floor(Math.random() * 4) + 1;
        for (let j = 0; j < count; j++) {
            const c = clients[Math.floor(Math.random() * clients.length)];
            const p = createdProducts[Math.floor(Math.random() * createdProducts.length)];
            const qty = Math.floor(Math.random() * 2) + 1;

            // Calculate prices based on rate
            // p.salePrice is in USD. 
            // We assume the system main currency is VES.
            // Subtotal (VES) = USD Price * Qty * Rate

            const priceUSD = Number(p.salePrice);
            const sub = priceUSD * qty * currentRate;
            const total = sub * 1.16;

            await prisma.sale.create({
                data: {
                    client: { connect: { id: c.id } },
                    date: d,
                    invoiceNumber: `FAC-${counter++}`,
                    subtotal: sub,
                    tax: sub * 0.16,
                    total: total,
                    paymentMethod: 'CASH',
                    exchangeRate: currentRate,
                    items: {
                        create: {
                            product: { connect: { id: p.id } },
                            quantity: qty,
                            unitPrice: priceUSD * currentRate, // Price in VES
                            total: sub
                        }
                    }
                }
            });
        }
    }

    // Gastos
    console.log('📉 Generando gastos...');
    const cats = ['RENT', 'UTILITIES', 'SALARY'];
    for (let m = 0; m < 6; m++) {
        const ed = new Date(); ed.setMonth(now.getMonth() - m);
        for (const cat of cats) {
            await prisma.expense.create({
                data: {
                    description: `Gasto ${cat}`,
                    amount: 200 + Math.random() * 200,
                    category: cat,
                    currencyCode: 'USD',
                    exchangeRate: 60,
                    date: ed,
                    paymentMethod: 'TRANSFER'
                }
            });
        }
    }

    console.log('✅ ¡Hecho!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
