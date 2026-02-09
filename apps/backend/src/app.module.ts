import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BanksModule } from './banks/banks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClientsModule } from './clients/clients.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ProductsModule } from './products/products.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { DepartmentsModule } from './departments/departments.module';
import { UnitsModule } from './units/units.module';
import { StatsModule } from './stats/stats.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { ExchangeRatesModule } from './currencies/exchange-rates.module';
import { SalesModule } from './sales/sales.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ReturnsModule } from './returns/returns.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { InventoryAdjustmentsModule } from './inventory-adjustments/inventory-adjustments.module';
import { DevToolsController } from './dev-tools/dev-tools.controller';
import { DevToolsService } from './dev-tools/dev-tools.service';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HrModule } from './hr/hr.module';
import { SystemModule } from './system/system.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { AIModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    ClientsModule,
    SuppliersModule,
    ProductsModule,
    CompanySettingsModule,
    DepartmentsModule,
    UnitsModule,
    CurrenciesModule,
    ExchangeRatesModule,
    SalesModule,
    InvoiceModule,
    ReturnsModule,
    CashRegisterModule,
    InventoryAdjustmentsModule,
    SuppliersModule,
    PurchasesModule,
    HrModule,
    BanksModule,
    StatsModule,
    PaymentsModule,
    ExpensesModule,
    UsersModule,
    AuthModule,
    SystemModule,
    PurchaseOrdersModule,
    AIModule,
  ],
  controllers: [AppController, DevToolsController],
  providers: [AppService, DevToolsService],
})
export class AppModule { }
