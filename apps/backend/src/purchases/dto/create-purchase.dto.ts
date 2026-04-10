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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  cost: number;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty()
  @IsType(() => Date)
  @IsDate()
  invoiceDate: Date;

  @ApiProperty()
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({ enum: ['UNPAID', 'PARTIAL', 'PAID'] })
  @IsString()
  @IsOptional()
  @IsEnum(['UNPAID', 'PARTIAL', 'PAID'])
  paymentStatus?: string;

  @ApiProperty()
  @IsOptional()
  @IsType(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  paidAmount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  taxAmount?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  purchaseOrderId?: string;
}

// Function helper since IsDate sometimes needs help with transformation
function IsType(type: any): (target: object, propertyKey: string) => void {
  return Type(type);
}
