import { Module } from '@nestjs/common';
import { DailyCashBalanceService } from './daily-cash-balance.service';
import { DailyCashBalanceController } from './daily-cash-balance.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyCashBalanceController],
  providers: [DailyCashBalanceService],
})
export class DailyCashBalanceModule {}
