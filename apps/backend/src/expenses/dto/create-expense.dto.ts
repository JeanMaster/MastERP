import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Electricity Bill', description: 'Description of the expense' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 150.5, description: 'Amount of the expense' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'VES', description: 'Currency code' })
  @IsNotEmpty()
  @IsString()
  currencyCode: string;

  @ApiProperty({ example: 36.5, description: 'Exchange rate used for the transaction' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  exchangeRate: number;

  @ApiProperty({ required: false, description: 'Date of the expense (ISO string)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: 'SERVICES', description: 'Category of the expense' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 'CASH', description: 'Payment method used' })
  @IsNotEmpty()
  @IsString()
  paymentMethod: string;

  @ApiProperty({ required: false, description: 'External reference or invoice number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false, description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, default: 0, description: 'Tax amount included' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @ApiProperty({ required: false, default: false, description: 'Whether the expense is taxable' })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiProperty({ required: false, description: 'ID of the bank account if paid by transfer/card' })
  @IsOptional()
  @IsString()
  bankAccountId?: string;
}
