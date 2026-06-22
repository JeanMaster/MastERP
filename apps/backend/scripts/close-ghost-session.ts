const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  console.log('=== Cerrador de Sesión Fantasma de Caja ===\n');

  const ghostSessions = await prisma.cashSession.findMany({
    where: { status: { in: ['OPEN', 'AWAITING_CLOSE'] } },
    include: { movements: true, register: true },
  });

  if (ghostSessions.length === 0) {
    console.log('✅ No hay sesiones fantasma abiertas.');
    return;
  }

  console.log(`Encontradas ${ghostSessions.length} sesión(es) abierta(s):\n`);
  
  ghostSessions.forEach((s, i) => {
    console.log(`${i + 1}. ID: ${s.id}`);
    console.log(`   Caja: ${s.register?.name || 'Sin nombre'}`);
    console.log(`   Estado: ${s.status}`);
    console.log(`   Apertura: ${s.openedAt?.toISOString()}`);
    console.log(`   Saldo inicial: ${Number(s.openingBalance).toFixed(2)} VES\n`);
  });

  if (mode === '--force' || mode === '-f') {
    for (const session of ghostSessions) {
      const expectedBalance = calculateExpectedBalance(
        session.movements,
        Number(session.openingBalance)
      );

      await prisma.cashMovement.create({
        data: {
          sessionId: session.id,
          type: 'CLOSING',
          amount: expectedBalance,
          currencyCode: 'VES',
          exchangeRate: 1,
          description: 'Cierre manual automático - sesión fantasma',
          performedBy: 'Terminal',
        },
      });

      await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: 'Terminal',
          expectedBalance,
          actualBalance: expectedBalance,
          variance: 0,
          closingNotes: 'Cierre automático de sesión fantasma',
        },
      });

      console.log(`✅ Sesión ${session.id} cerrada correctamente.`);
    }
  } else {
    console.log('Para cerrar automáticamente, ejecuta:');
    console.log('  npx ts-node scripts/close-ghost-session.ts --force');
  }
}

function calculateExpectedBalance(movements, openingBalance) {
  let expected = Number(openingBalance);
  for (const m of movements) {
    const amountInVES = Number(m.amount) * Number(m.exchangeRate || 1);
    switch (m.type) {
      case 'SALE':
      case 'WITHDRAWAL':
      case 'ADJUSTMENT':
        expected += amountInVES;
        break;
      case 'EXPENSE':
      case 'DEPOSIT':
      case 'CLOSING':
      case 'CHANGE':
        expected -= amountInVES;
        break;
    }
  }
  return expected;
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });