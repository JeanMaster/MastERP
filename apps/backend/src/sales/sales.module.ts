import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InvoiceModule } from '../invoice/invoice.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';
import { StatsModule } from '../stats/stats.module';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';

@Module({
  imports: [InvoiceModule, CashRegisterModule, StatsModule, MercadoLibreModule],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
