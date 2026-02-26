import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking for admin user...');
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (admin) {
      console.log('✅ Admin user exists:', admin.id);
      // Optional: Reset password if requested, but user didn't ask explicitly yet.
      // Just verifying existence.
    } else {
      console.log('❌ Admin user NOT found. Recreating...');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      const newAdmin = await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          name: 'Administrador Principal',
          role: 'ADMIN',
          permissions: ['ALL'],
          isActive: true,
        },
      });
      console.log(
        '✅ Admin user recreated with default password (admin123). ID:',
        newAdmin.id,
      );
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
