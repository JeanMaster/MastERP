import { Module } from '@nestjs/common';
import { TaxRetentionsService } from './tax-retentions.service';
import { TaxRetentionsController } from './tax-retentions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [TaxRetentionsController],
  providers: [TaxRetentionsService],
  exports: [TaxRetentionsService],
  imports: [PrismaModule],
})
export class TaxRetentionsModule {}
