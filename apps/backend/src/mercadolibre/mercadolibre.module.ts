import { Module } from '@nestjs/common';
import { MercadoLibreService } from './mercadolibre.service';
import { MercadoLibreController } from './mercadolibre.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MercadoLibreController],
  providers: [MercadoLibreService],
  exports: [MercadoLibreService],
})
export class MercadoLibreModule {}
