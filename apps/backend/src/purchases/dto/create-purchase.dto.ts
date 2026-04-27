import {
  IsString,
  IsNotEmpty,
  IsDate,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseItemDto {
  @ApiProperty({ example: 'uuid-of-product', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 10, description: 'Quantity purchased' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 5.5, description: 'Unit cost price in purchase currency' })
  @IsNumber()
  @Min(0)
  cost: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'uuid-of-supplier', description: 'Supplier ID' })
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({ example: '2026-04-25', description: 'Invoice date' })
  @Type(() => Date)
  @IsDate()
  invoiceDate: Date;

  @ApiProperty({ example: 'INV-001', required: false, description: 'Supplier invoice number' })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ type: [PurchaseItemDto], description: 'List of purchased items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiProperty({ example: 'USD', required: false, description: 'Currency code' })
  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ApiProperty({ example: 36.5, required: false, description: 'Exchange rate at time of purchase' })
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({ enum: ['UNPAID', 'PARTIAL', 'PAID'], required: false, description: 'Initial payment status' })
  @IsString()
  @IsOptional()
  @IsEnum(['UNPAID', 'PARTIAL', 'PAID'])
  paymentStatus?: string;

  @ApiProperty({ example: '2026-05-25', required: false, description: 'Payment due date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiProperty({ example: 55.0, required: false, description: 'Initial amount paid' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  paidAmount?: number;

  @ApiProperty({ example: 8.8, required: false, description: 'Total tax amount from invoice' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ example: 'uuid-of-order', required: false, description: 'Related purchase order ID' })
  @IsString()
  @IsOptional()
  purchaseOrderId?: string;
}

