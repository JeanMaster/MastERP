import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReturnItemDto {
  @ApiProperty({ description: 'ID of the product being returned' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantity returned' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price at the time of sale' })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ description: 'Total amount for this item' })
  @IsNumber()
  total: number;
}

export enum ReturnType {
  REFUND = 'REFUND',
  EXCHANGE_SAME = 'EXCHANGE_SAME',
  EXCHANGE_DIFFERENT = 'EXCHANGE_DIFFERENT',
}

export enum ReturnReason {
  DEFECTIVE = 'DEFECTIVE',
  UNSATISFIED = 'UNSATISFIED',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
  OTHER = 'OTHER',
}

export enum ProductCondition {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  DEFECTIVE = 'DEFECTIVE',
  DAMAGED = 'DAMAGED',
}

export enum RefundMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CREDIT_NOTE = 'CREDIT_NOTE',
}

export class CreateReturnDto {
  @ApiProperty({ description: 'ID of the original sale' })
  @IsString()
  originalSaleId: string;

  @ApiProperty({ enum: ReturnType, description: 'Type of return' })
  @IsEnum(ReturnType)
  returnType: ReturnType;

  @ApiProperty({ enum: ReturnReason, description: 'Reason for the return' })
  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @ApiProperty({
    enum: ProductCondition,
    description: 'Condition of the returned product',
  })
  @IsEnum(ProductCondition)
  productCondition: ProductCondition;

  @ApiProperty({ type: [CreateReturnItemDto], description: 'Items being returned' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];

  @ApiProperty({
    type: [CreateReturnItemDto],
    required: false,
    description: 'Replacement items delivered in an exchange',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  replacementItems?: CreateReturnItemDto[];

  @ApiProperty({ description: 'Amount to refund' })
  @IsNumber()
  @Min(0)
  refundAmount: number;

  @ApiProperty({
    enum: RefundMethod,
    required: false,
    description: 'Refund method',
  })
  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;

  @ApiProperty({ required: false, description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    required: false,
    description: 'Username of the person requesting the return',
  })
  @IsOptional()
  @IsString()
  requestedBy?: string;
}
