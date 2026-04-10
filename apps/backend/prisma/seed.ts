
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminExists = await (prisma as any).user.findUnique({
        where: { username: 'admin' },
    });

    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const allPermissions = [
            'MODULE_POS', 'VIEW_SALES', 'MANAGE_CASH_REGISTER', 'VOID_SALES',
            'VIEW_PRODUCTS', 'EDIT_PRODUCTS', 'INVENTORY_ADJUSTMENTS',
            'MODULE_PURCHASES', 'MODULE_EXPENSES', 'MODULE_REPORTS', 'MODULE_CONFIG'
        ];

        await (prisma as any).user.create({
            data: {
                username: 'admin',
                password: hashedPassword,
                name: 'MastERP Admin',
                role: 'ADMIN',
                permissions: allPermissions,
            },
        });
        console.log('✅ Default admin user created (admin/admin123) with ALL permissions');
    } else {
        console.log('ℹ️ Admin user already exists');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
