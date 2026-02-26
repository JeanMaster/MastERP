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
  @ApiProperty({ description: 'ID del cliente' })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional({
    description: 'ID de la venta relacionada (si viene de POS)',
  })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiProperty({ description: 'Subtotal de la factura' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  subtotal: number;

  @ApiProperty({ description: 'Descuento aplicado', default: 0 })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ description: 'IVA aplicado', default: 0 })
  @IsOptional()
  @IsNumber()
  tax?: number;

  @ApiProperty({ description: 'Total de la factura' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  total: number;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento (para crédito)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}
