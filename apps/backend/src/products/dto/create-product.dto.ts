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
    description: 'Product type: PRODUCT, SERVICE, or COMPOSED',
    enum: ProductType,
    default: ProductType.PRODUCT,
  })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiProperty({ example: 'PROD-001', description: 'Product SKU' })
  @IsNotEmpty({ message: 'SKU is required' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Hammer 16oz', description: 'Product name' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Steel hammer with fiberglass handle',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'uuid-of-department',
    description: 'Category ID (main department)',
  })
  @IsNotEmpty({ message: 'Category is required' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: 'uuid-of-subdepartment',
    required: false,
    description: 'Subcategory ID (sub-department)',
  })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: 'uuid-of-currency', description: 'Currency ID' })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsUUID()
  currencyId: string;

  @ApiProperty({
    example: 10.5,
    description: 'Cost price (Required for Products and Composed)',
  })
  @ValidateIf((o) => o.type !== ProductType.SERVICE)
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Cost price must be greater than or equal to 0' })
  costPrice?: number;

  @ApiProperty({ example: 15.0, description: 'Normal sale price' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Sale price must be greater than or equal to 0' })
  salePrice: number;

  @ApiProperty({
    example: 12.0,
    required: false,
    description: 'Offer price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Offer price must be greater than or equal to 0' })
  offerPrice?: number;

  @ApiProperty({
    example: 13.5,
    required: false,
    description: 'Wholesale price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Wholesale price must be greater than or equal to 0' })
  wholesalePrice?: number;

  @ApiProperty({ example: 100, description: 'Initial stock' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Stock must be greater than or equal to 0' })
  stock?: number;

  @ApiProperty({
    example: 'uuid-of-unit',
    description: 'Main unit ID (Required for Products)',
  })
  @ValidateIf((o) => o.type !== ProductType.SERVICE)
  @IsNotEmpty({ message: 'Main unit is required' })
  @IsUUID()
  unitId?: string;

  // Secondary unit
  @ApiProperty({
    example: 'uuid-of-secondary-unit',
    required: false,
    description: 'Secondary unit ID',
  })
  @IsOptional()
  @IsUUID()
  secondaryUnitId?: string;

  @ApiProperty({
    example: 12,
    required: false,
    description: 'Quantity for unit conversion',
  })
  @ValidateIf((o) => o.secondaryUnitId)
  @Type(() => Number)
  @IsNumber()
  @Min(0.001, { message: 'Conversion quantity must be at least 0.001' })
  unitsPerSecondaryUnit?: number;

  @ApiProperty({
    example: 'primary_to_secondary',
    required: false,
    description:
      'Conversion direction: primary_to_secondary (12 UND = 1 Box) or secondary_to_primary (1 Roll = 50 Meters)',
    enum: ['primary_to_secondary', 'secondary_to_primary'],
  })
  @IsOptional()
  @IsString()
  conversionDirection?: string;

  // Secondary unit prices
  @ApiProperty({
    example: 100.0,
    required: false,
    description: 'Cost price for secondary unit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryCostPrice?: number;

  @ApiProperty({
    example: 150.0,
    required: false,
    description: 'Sale price for secondary unit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondarySalePrice?: number;

  @ApiProperty({
    example: 120.0,
    required: false,
    description: 'Offer price for secondary unit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryOfferPrice?: number;

  @ApiProperty({
    example: 135.0,
    required: false,
    description: 'Wholesale price for secondary unit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  secondaryWholesalePrice?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Whether the product is tax exempt',
  })
  @IsOptional()
  isTaxExempt?: boolean;

  @ApiProperty({
    example: ['https://example.com/image1.jpg'],
    required: false,
    description: 'Product image URLs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    example: [{ componentProductId: 'uuid', quantity: 2 }],
    required: false,
    description: 'Product components (only for COMPOSED type)',
  })
  @IsOptional()
  @ValidateIf((o) => o.type === ProductType.COMPOSED)
  @Type(() => Object)
  components?: Array<{ componentProductId: string; quantity: number }>;
}

