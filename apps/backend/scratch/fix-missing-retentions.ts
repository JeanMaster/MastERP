import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingRetentions() {
  console.log('--- Iniciando reparación de retenciones faltantes ---');
  
  // 1. Encontrar ventas que tengan RETENTION_IVA en el método de pago 
  // pero que no tengan una factura vinculada (o cuya factura no tenga retenciones registradas)
  const salesWithRetention = await prisma.sale.findMany({
    where: {
      paymentMethod: { contains: 'RETENTION_IVA' },
      invoice: null
    },
    include: {
      client: true
    }
  });

  console.log(`Encontradas ${salesWithRetention.length} ventas con retención sin factura.`);

  for (const sale of salesWithRetention) {
    console.log(`\nProcesando Venta: ${sale.id} (${sale.invoiceNumber})`);
    
    // Parsear el monto y comprobante del método de pago
    // Formato: ..., RETENTION_IVA:amount:voucher, ...
    const methods = sale.paymentMethod.split(', ');
    const retentionPart = methods.find(m => m.startsWith('RETENTION_IVA'));
    
    if (!retentionPart) {
      console.log('  No se encontró la parte de retención en el string de pago.');
      continue;
    }

    const [, amountStr, voucherNumber] = retentionPart.split(':');
    const amount = parseFloat(amountStr);
    const voucher = voucherNumber || `POS-${sale.invoiceNumber}`;

    if (isNaN(amount)) {
      console.log('  Monto de retención inválido.');
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // A. Crear la factura PAGADA
        console.log(`  Creando factura FAC para la venta ${sale.invoiceNumber}...`);
        const invoice = await tx.invoice.create({
          data: {
            number: sale.invoiceNumber,
            clientId: sale.clientId || '',
            saleId: sale.id,
            subtotal: sale.subtotal,
            discount: sale.discount,
            tax: sale.tax,
            total: sale.total,
            balance: 0,
            paidAmount: sale.total,
            status: 'PAID',
            notes: `Factura generada retroactivamente para registro de retención - ${sale.invoiceNumber}`,
            currencyCode: 'VES',
            exchangeRate: sale.exchangeRate
          }
        });

        // B. Crear el registro de retención
        console.log(`  Creando registro de retención: ${voucher} por Bs. ${amount}...`);
        const retention = await tx.taxRetention.create({
          data: {
            invoiceId: invoice.id,
            voucherNumber: voucher,
            voucherDate: sale.createdAt,
            type: 'IVA',
            baseAmount: sale.subtotal,
            retentionPercent: Math.round((amount / Number(sale.tax)) * 100),
            amount: amount,
          }
        });

        // C. Crear registro de pago tipo retención en la factura para que el balance sea real
        // (Aunque pusimos balance 0 al crearla, es bueno tener el historial de pagos)
        await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amount,
              paymentMethod: 'RETENTION_IVA',
              reference: voucher,
              notes: `Retención recuperada retroactivamente`,
            },
          });
          
        console.log('  ¡Éxito!');
      });
    } catch (error) {
      console.error(`  Error procesando venta ${sale.id}:`, error.message);
    }
  }

  console.log('\n--- Proceso finalizado ---');
}

fixMissingRetentions()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
