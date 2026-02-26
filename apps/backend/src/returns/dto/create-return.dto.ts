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
  @ApiProperty({ description: 'ID del producto' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Cantidad devuelta' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Precio unitario' })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ description: 'Total del item' })
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
  @ApiProperty({ description: 'ID de la venta original' })
  @IsString()
  originalSaleId: string;

  @ApiProperty({ enum: ReturnType, description: 'Tipo de devolución' })
  @IsEnum(ReturnType)
  returnType: ReturnType;

  @ApiProperty({ enum: ReturnReason, description: 'Razón de la devolución' })
  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @ApiProperty({
    enum: ProductCondition,
    description: 'Condición del producto devuelto',
  })
  @IsEnum(ProductCondition)
  productCondition: ProductCondition;

  @ApiProperty({ type: [CreateReturnItemDto], description: 'Items devueltos' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];

  @ApiProperty({
    type: [CreateReturnItemDto],
    required: false,
    description: 'Items entregados en cambio',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  replacementItems?: CreateReturnItemDto[];

  @ApiProperty({ description: 'Monto a reembolsar' })
  @IsNumber()
  @Min(0)
  refundAmount: number;

  @ApiProperty({
    enum: RefundMethod,
    required: false,
    description: 'Método de reembolso',
  })
  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;

  @ApiProperty({ required: false, description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    required: false,
    description: 'Usuario que solicita la devolución',
  })
  @IsOptional()
  @IsString()
  requestedBy?: string;
}
