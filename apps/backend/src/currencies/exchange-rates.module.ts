import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ExchangeRateService } from './exchange-rate.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRatesModule {}
