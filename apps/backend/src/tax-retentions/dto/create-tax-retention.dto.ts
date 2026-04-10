import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDate,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaxRetentionDto {
  @IsString()
  @IsNotEmpty()
  type: string; // IVA, ISLR, MUNICIPAL

  @IsString()
  @IsNotEmpty()
  voucherNumber: string;

  @IsDate()
  @Type(() => Date)
  voucherDate: Date;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseAmount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  retentionPercent: number;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  purchaseId?: string;
}
