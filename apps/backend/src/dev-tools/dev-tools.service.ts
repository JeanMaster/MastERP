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
   * Resetear la base de datos (SOLO PARA DESARROLLO)
   */
  async resetDatabase(): Promise<{ message: string; success: boolean }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Esta operación no está permitida en producción');
    }

    try {
      console.log('Starting selective database cleanup...');

      // List of tables to clear in order (to minimize constraint issues, though we use CASCADE)
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
        console.error('Error clearing other users:', e);
      }

      // Ensure admin exists
      await this.ensureAdminExists();

      return {
        success: true,
        message:
          'Base de datos limpiada exitosamente. El usuario admin ha sido preservado.',
      };
    } catch (error) {
      console.error('Error during selective reset:', error);

      // Fallback to force reset if manual cleanup fails completely
      try {
        console.log('Falling back to force reset...');
        await execAsync('npx prisma db push --force-reset --accept-data-loss');
        await this.ensureAdminExists();
        return {
          success: true,
          message: 'Reset forzado completado. Usuario admin recreado.',
        };
      } catch (fallbackError) {
        throw new Error(
          'Error crítico al resetear la base de datos: ' +
            fallbackError.message,
        );
      }
    }
  }

  /**
   * Garantiza que el usuario administrador exista con todos los permisos
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
            name: 'Zenith Admin',
            role: 'ADMIN',
            permissions: allPermissions,
          },
        });
        console.log('✅ Default admin user created');
      } else {
        // Si existe, nos aseguramos que tenga todos los permisos
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
   * Reinicio financiero: Borra transacciones pero mantiene catálogos
   */
  async financialReset(): Promise<{ message: string; success: boolean }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Esta operación no está permitida en producción');
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

      // Resetear contadores de facturas
      try {
        await (this.prisma as any).invoiceCounter.updateMany({
          data: { currentNumber: 1 },
        });
      } catch (e) {
        console.warn('Could not reset invoice counters:', e.message);
      }

      // Resetear saldos bancarios a 0
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
          'Reinicio financiero completado. Se han borrado ventas, compras, gastos y movimientos de caja sin afectar catálogos.',
      };
    } catch (error) {
      console.error('Error during financial reset:', error);
      throw new Error(
        'Error al realizar el reinicio financiero: ' + error.message,
      );
    }
  }

  /**
   * Respalda la base de datos generando un archivo SQL
   */
  async backupDatabase(): Promise<{ path: string; filename: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const outputPath = `/tmp/${filename}`;

    // Extraer credenciales de DATABASE_URL si es necesario, o confiar en el entorno
    // Asumimos que pg_dump está instalado y disponible en el PATH
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL no está definida');

    try {
      // Limpiar la URL de parámetros query que pg_dump no soporta (como ?schema=public)
      const cleanDbUrl = dbUrl.split('?')[0];

      // Usamos pg_dump con flags para asegurar una restauración limpia:
      // --clean: incluye comandos para borrar objetos antes de crearlos
      // --if-exists: no falla si los objetos no existen
      // --no-owner: evita errores de permisos de usuario
      // --no-privileges: evita errores de permisos de sistema
      await execAsync(
        `pg_dump --clean --if-exists --no-owner --no-privileges "${cleanDbUrl}" > "${outputPath}"`,
      );

      return {
        path: outputPath,
        filename: filename,
      };
    } catch (error) {
      console.error('Error durante el backup:', error);
      throw new Error('Error al generar el respaldo de la base de datos');
    }
  }

  /**
   * Restaura la base de datos desde un archivo SQL
   */
  async restoreDatabase(
    file: any,
  ): Promise<{ success: boolean; message: string }> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL no está definida');

    let filePath = file.path;
    let tempCreated = false;

    try {
      // Si no hay path (memory storage), escribimos el buffer a un archivo temporal
      if (!filePath && file.buffer) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `restore-${timestamp}.sql`;
        filePath = join('/tmp', filename);
        await writeFile(filePath, file.buffer);
        tempCreated = true;
      }

      if (!filePath) {
        throw new Error(
          'No se pudo determinar la ruta del archivo de respaldo',
        );
      }

      // Limpiar la URL de parámetros query (ej. ?schema=public)
      const cleanDbUrl = dbUrl.split('?')[0];

      // Ejecutar el archivo SQL
      await execAsync(`psql "${cleanDbUrl}" < "${filePath}"`);

      // Asegurar que el admin existe tras restaurar (por si el backup es muy viejo)
      await this.ensureAdminExists();

      return {
        success: true,
        message:
          'Base de datos restaurada exitosamente. Se ha validado el acceso de administrador.',
      };
    } catch (error) {
      console.error('Error durante la restauración:', error);
      throw new Error('Error al restaurar la base de datos: ' + error.message);
    } finally {
      // Limpiar archivo temporal si fue creado por nosotros
      if (tempCreated && filePath) {
        try {
          await unlink(filePath);
        } catch (e) {
          console.error('Error eliminando archivo temporal:', e);
        }
      }
    }
  }
}
