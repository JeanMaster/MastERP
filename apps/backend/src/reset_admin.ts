import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Resetting admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const updated = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        password: hashedPassword,
        isActive: true, // Ensure it's active
        permissions: ['ALL'], // Ensure full permissions
        role: 'ADMIN',
      },
    });
    console.log('✅ Admin user reset. Password: admin123. ID:', updated.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
