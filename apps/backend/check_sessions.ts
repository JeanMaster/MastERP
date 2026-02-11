import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sessions = await prisma.cashSession.findMany({
        take: 5,
        orderBy: { openedAt: 'desc' },
        select: {
            openingBalance: true,
            actualBalance: true,
            expectedBalance: true,
            status: true,
            openedAt: true
        }
    });
    console.log(JSON.stringify(sessions, null, 2));
}
main().finally(() => prisma.$disconnect());
