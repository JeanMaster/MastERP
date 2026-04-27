import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'ID of the client' })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional({
    description: 'ID of the related sale (if coming from POS)',
  })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiProperty({ description: 'Invoice subtotal' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  subtotal: number;

  @ApiProperty({ description: 'Discount applied', default: 0 })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ description: 'Tax (VAT) applied', default: 0 })
  @IsOptional()
  @IsNumber()
  tax?: number;

  @ApiProperty({ description: 'Invoice total' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  total: number;

  @ApiPropertyOptional({ description: 'Due date for credit invoices (ISO date)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
