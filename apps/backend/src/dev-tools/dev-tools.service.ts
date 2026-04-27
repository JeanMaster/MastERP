import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const execAsync = promisify(exec);

@Injectable()
export class DevToolsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resets the database by truncating all transactional tables (DEVELOPMENT ONLY).
   * Preserves the admin user.
   * @returns A success/failure result message.
   */
  async resetDatabase(): Promise<{ message: string; success: boolean }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('This operation is not allowed in production');
    }

    try {
      console.log('Starting selective database cleanup...');

      // Tables to clear in dependency order (CASCADE handles FK constraints)
      const tables = [
        'purchase_payments',
        'purchase_items',
        'purchases',
        'payments',
        'invoices',
        'sale_items',
        'sales',
        'inventory_adjustments',
        'return_items',
        'returns',
        'cash_movements',
        'cash_sessions',
        'cash_registers',
        'expenses',
        'payroll_payment_items',
        'payroll_payments',
        'payroll_periods',
        'employees',
        'bank_accounts',
        'products',
        'clients',
        'suppliers',
        'departments',
        'units',
        'currencies',
        'company_settings',
        'invoice_counters',
      ];

      for (const table of tables) {
        try {
          await this.prisma.$executeRawUnsafe(
            `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
          );
        } catch (e) {
          console.warn(
            `Could not truncate ${table} (it might not exist yet):`,
            e.message,
          );
        }
      }

      // Delete all users except 'admin'
      try {
        await (this.prisma as any).user.deleteMany({
          where: {
            username: { not: 'admin' },
          },
        });
      } catch (e) {
        console.error('Error clearing non-admin users:', e);
      }

      // Ensure admin user exists with full permissions
      await this.ensureAdminExists();

      return {
        success: true,
        message:
          'Database cleaned successfully. The admin user has been preserved.',
      };
    } catch (error) {
      console.error('Error during selective reset:', error);

      // Fallback to force reset if manual cleanup fails
      try {
        console.log('Falling back to force reset...');
        await execAsync('npx prisma db push --force-reset --accept-data-loss');
        await this.ensureAdminExists();
        return {
          success: true,
          message: 'Force reset completed. Admin user recreated.',
        };
      } catch (fallbackError) {
        throw new Error(
          'Critical error resetting database: ' + fallbackError.message,
        );
      }
    }
  }

  /**
   * Ensures that the admin user exists with all permissions.
   * Creates the user if missing, or updates permissions if it already exists.
   */
  private async ensureAdminExists() {
    try {
      const admin = await (this.prisma as any).user.findUnique({
        where: { username: 'admin' },
      });

      const hashedPassword = await bcrypt.hash('admin123', 10);
      const allPermissions = [
        'MODULE_POS',
        'VIEW_SALES',
        'MANAGE_CASH_REGISTER',
        'VOID_SALES',
        'VIEW_PRODUCTS',
        'EDIT_PRODUCTS',
        'INVENTORY_ADJUSTMENTS',
        'MODULE_PURCHASES',
        'MODULE_EXPENSES',
        'MODULE_REPORTS',
        'MODULE_CONFIG',
      ];

      if (!admin) {
        await (this.prisma as any).user.create({
          data: {
            username: 'admin',
            password: hashedPassword,
            name: 'MastERP Admin',
            role: 'ADMIN',
            permissions: allPermissions,
          },
        });
        console.log('✅ Default admin user created');
      } else {
        // Ensure admin has all permissions
        await (this.prisma as any).user.update({
          where: { username: 'admin' },
          data: { permissions: allPermissions },
        });
        console.log('✅ Admin user updated with full permissions');
      }
    } catch (error) {
      console.error('Critical error ensuring admin exists:', error);
      throw error;
    }
  }

  /**
   * Performs a financial reset: clears transactions but keeps master data (products, clients, etc.).
   * @returns A success/failure result message.
   */
  async financialReset(): Promise<{ message: string; success: boolean }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('This operation is not allowed in production');
    }

    try {
      console.log('Starting financial cleanup...');

      const tables = [
        'purchase_payments',
        'purchase_items',
        'purchases',
        'payments',
        'invoices',
        'sale_items',
        'sales',
        'inventory_adjustments',
        'return_items',
        'returns',
        'cash_movements',
        'cash_sessions',
        'expenses',
        'payroll_payment_items',
        'payroll_payments',
        'payroll_periods',
      ];

      for (const table of tables) {
        try {
          await this.prisma.$executeRawUnsafe(
            `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
          );
        } catch (e) {
          console.warn(`Could not truncate ${table}:`, e.message);
        }
      }

      // Reset invoice counters
      try {
        await (this.prisma as any).invoiceCounter.updateMany({
          data: { currentNumber: 1 },
        });
      } catch (e) {
        console.warn('Could not reset invoice counters:', e.message);
      }

      // Reset bank account balances to 0
      try {
        await (this.prisma as any).bankAccount.updateMany({
          data: { balance: 0 },
        });
      } catch (e) {
        console.warn('Could not reset bank balances:', e.message);
      }

      return {
        success: true,
        message:
          'Financial reset completed. Sales, purchases, expenses, and cash movements have been cleared without affecting master data.',
      };
    } catch (error) {
      console.error('Error during financial reset:', error);
      throw new Error('Error performing financial reset: ' + error.message);
    }
  }

  /**
   * Generates a SQL backup of the database using pg_dump.
   * @returns The path and filename of the generated backup file.
   */
  async backupDatabase(): Promise<{ path: string; filename: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const outputPath = `/tmp/${filename}`;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    try {
      // Remove query parameters that pg_dump doesn't support (e.g., ?schema=public)
      const cleanDbUrl = dbUrl.split('?')[0];

      // pg_dump flags:
      // --clean: include DROP commands before CREATE
      // --if-exists: don't fail if objects don't exist
      // --no-owner: skip ownership commands to avoid permission errors
      // --no-privileges: skip GRANT/REVOKE commands
      await execAsync(
        `pg_dump --clean --if-exists --no-owner --no-privileges "${cleanDbUrl}" > "${outputPath}"`,
      );

      return {
        path: outputPath,
        filename: filename,
      };
    } catch (error) {
      console.error('Error generating backup:', error);
      throw new Error('Error generating database backup');
    }
  }

  /**
   * Restores the database from an uploaded SQL file.
   * @param file The uploaded SQL file (multer file object).
   * @returns A success/failure result message.
   */
  async restoreDatabase(
    file: any,
  ): Promise<{ success: boolean; message: string }> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    let filePath = file.path;
    let tempCreated = false;

    try {
      // If no path (memory storage), write the buffer to a temp file
      if (!filePath && file.buffer) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `restore-${timestamp}.sql`;
        filePath = join('/tmp', filename);
        await writeFile(filePath, file.buffer);
        tempCreated = true;
      }

      if (!filePath) {
        throw new Error('Could not determine the path of the backup file');
      }

      // Remove query parameters from the URL
      const cleanDbUrl = dbUrl.split('?')[0];

      // Execute the SQL file
      await execAsync(`psql "${cleanDbUrl}" < "${filePath}"`);

      // Ensure admin still exists after restore (in case the backup is outdated)
      await this.ensureAdminExists();

      return {
        success: true,
        message:
          'Database restored successfully. Administrator access has been validated.',
      };
    } catch (error) {
      console.error('Error during database restore:', error);
      throw new Error('Error restoring database: ' + error.message);
    } finally {
      // Clean up temp file if we created it
      if (tempCreated && filePath) {
        try {
          await unlink(filePath);
        } catch (e) {
          console.error('Error deleting temporary file:', e);
        }
      }
    }
  }
}
