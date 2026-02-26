import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  IsUUID,
  ValidateIf,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ProductType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  COMPOSED = 'COMPOSED',
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Tipo de producto: PRODUCT o SERVICE',
    enum: ProductType,
    default: ProductType.PRODUCT,
  })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiProperty({ example: 'PROD-001', description: 'SKU del producto' })
  @IsNotEmpty({ message: 'El SKU es requerido' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Martillo 16oz', description: 'Nombre del producto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Martillo de acero con mango de fibra',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'uuid-del-departamento',
    description: 'ID de la categoría (departamento principal)',
  })
  @IsNotEmpty({ message: 'La categoría es requerida' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: 'uuid-del-subdepartamento',
    required: false,
    description: 'ID de la subcategoría (subdepartamento)',
  })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: 'uuid-de-la-moneda', description: 'ID de la moneda' })
  @IsNotEmpty({ message: 'La moneda es requerida' })
  @IsUUID()
  currencyId: string;

  @ApiProperty({
    example: 10.5,
    description: 'Precio de costo (Requerido para Productos)',
  })
  @ValidateIf((o) => o.type !== ProductType.SERVICE)
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El precio de costo debe ser mayor o igual a 0' })
  costPrice?: number;

  @ApiProperty({ example: 15.0, description: 'Precio de venta normal' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El precio de venta debe ser mayor o igual a 0' })
  salePrice: number;

  @ApiProperty({
    example: 12.0,
    required: false,
    description: 'Precio en oferta',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El precio en oferta debe ser mayor o igual a 0' })
  offerPrice?: number;

  @ApiProperty({
    example: 13.5,
    required: false,
    description: 'Precio al mayor',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El precio al mayor debe ser mayor o igual a 0' })
  wholesalePrice?: number;

  @ApiProperty({ example: 100, description: 'Stock inicial' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El stock debe ser mayor o igual a 0' })
  stock?: number;

  @ApiProperty({
    example: 'uuid-de-la-unidad',
    description: 'ID de la unidad principal (Requerido para Productos)',
  })
  @ValidateIf((o) => o.type !== ProductType.SERVICE)
  @IsNotEmpty({ message: 'La unidad principal es requerida' })
  @IsUUID()
  unitId?: string;

  // Unidad secundaria
  @ApiProperty({
    example: 'uuid-de-la-unidad-secundaria',
    required: false,
    description: 'ID de la unidad secundaria',
  })
  @IsOptional()
  @IsUUID()
  secondaryUnitId?: string;

  @ApiProperty({
    example: 12,
    required: false,
    description: 'Cantidad para conversión entre unidades',
  })
  @ValidateIf((o) => o.secondaryUnitId)
  @Type(() => Number)
  @IsNumber()
  @Min(0.001, { message: 'Debe haber al menos 0.001 en la conversión' })
  unitsPerSecondaryUnit?: number;

  @ApiProperty({
    example: 'primary_to_secondary',
    required: false,
    description:
      'Dirección de conversión: primary_to_secondary (12 UND = 1 Caja) o secondary_to_primary (1 Rollo = 50 Metros)',
    enum: ['primary_to_secondary', 'secondary_to_primary'],
  })
  @IsOptional()
  @IsString()
  conversionDirection?: string;

  // Precios para unidad secundaria
  @ApiProperty({
    example: 100.0,
    required: false,
    description: 'Precio de costo para unidad secundaria',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryCostPrice?: number;

  @ApiProperty({
    example: 150.0,
    required: false,
    description: 'Precio de venta para unidad secundaria',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondarySalePrice?: number;

  @ApiProperty({
    example: 120.0,
    required: false,
    description: 'Precio en oferta para unidad secundaria',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryOfferPrice?: number;

  @ApiProperty({
    example: 135.0,
    required: false,
    description: 'Precio al mayor para unidad secundaria',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryWholesalePrice?: number;

  @ApiProperty({
    example: ['https://example.com/image1.jpg'],
    required: false,
    description: 'URLs de las imágenes del producto',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    example: [{ componentProductId: 'uuid', quantity: 2 }],
    required: false,
    description: 'Componentes del producto (solo para tipo COMPOSED)',
  })
  @IsOptional()
  @ValidateIf((o) => o.type === ProductType.COMPOSED)
  @Type(() => Object)
  components?: Array<{ componentProductId: string; quantity: number }>;
}
