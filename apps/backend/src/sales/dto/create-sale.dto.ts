import {
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CreateSaleItemDto {
  @ApiProperty({ example: 'uuid-of-product', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity of items' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 10.5, description: 'Unit price in primary currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 21.0, description: 'Total price for this item' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total: number;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'uuid-of-client', required: false, description: 'Client ID' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ type: [CreateSaleItemDto], description: 'List of sale items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiProperty({ example: 20.0, description: 'Sale subtotal' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @ApiProperty({ example: 1.0, description: 'Total discount applied' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount: number;

  @ApiProperty({ example: 2.0, description: 'Total tax (VAT) applied' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax: number;

  @ApiProperty({ example: 0.5, required: false, description: 'IGTF (3% tax) amount if applicable' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  igtfAmount?: number;

  @ApiProperty({ example: 21.5, description: 'Final total amount in primary currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total: number;

  @ApiProperty({ example: 'CASH:10.0, DEBIT:11.5', description: 'Raw payment method string' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ example: 30.0, required: false, description: 'Amount tendered by the client' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  tendered?: number;

  @ApiProperty({ example: 8.5, required: false, description: 'Change given to the client' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  change?: number;

  @ApiProperty({ example: '000001', required: false, description: 'Pre-reserved invoice number' })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ example: 36.5, required: false, description: 'Exchange rate used for this sale' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({ example: 'uuid-of-session', required: false, description: 'Active cash session ID' })
  @IsString()
  @IsOptional()
  cashSessionId?: string;

  @ApiProperty({ example: 'uuid-of-coupon', required: false, description: 'ID of the used coupon' })
  @IsString()
  @IsOptional()
  couponId?: string;
}
