import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de normalización de categorías...');

  const mappings = [
    { target: 'RENT', sources: ['ALQUILER', 'RENT'] },
    { target: 'SERVICES', sources: ['SERVICIOS', 'SERVICES'] },
    { target: 'PAYROLL', sources: ['NOMINA', 'NÓMINA', 'PAYROLL', 'PATROLL'] },
    { target: 'SUPPLIERS', sources: ['PROVEEDORES', 'SUPPLIERS'] },
    { target: 'MAINTENANCE', sources: ['MANTENIMIENTO', 'MAINTENANCE'] },
    { target: 'TRANSPORTATION', sources: ['TRANSPORTE', 'TRANSPORTATION'] },
    { target: 'OTHERS', sources: ['OTROS', 'OTHERS'] },
  ];

  let totalUpdated = 0;
  for (const map of mappings) {
    const res = await prisma.expense.updateMany({
      where: {
        category: {
          in: map.sources,
          mode: 'insensitive',
        },
      },
      data: {
        category: map.target,
      },
    });
    console.log(`✓ Se actualizaron ${res.count} registros para la categoría: ${map.target}`);
    totalUpdated += res.count;
  }

  console.log(`¡Migración completada! Total de registros de gastos corregidos: ${totalUpdated}`);
}

main()
  .catch((e) => {
    console.error('Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
