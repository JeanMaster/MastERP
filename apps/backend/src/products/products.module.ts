import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ImageCompressionService } from './image-compression.service';

@Module({
  providers: [ProductsService, ImageCompressionService],
  controllers: [ProductsController],
})
export class ProductsModule {}
