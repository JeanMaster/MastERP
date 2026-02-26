import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class OpenSessionDto {
  @ApiProperty({ description: 'ID del registro de caja' })
  @IsString()
  registerId: string;

  @ApiProperty({
    description: 'Saldo inicial (opcional, se calcula si hay items)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ApiProperty({ description: 'Desglose de efectivo', required: false })
  @IsOptional()
  items?: { denominationId: string; quantity: number }[];

  @ApiProperty({ description: 'Tasa de cambio aplicada', required: false })
  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @ApiProperty({
    description: 'Usuario que abre (Admin/Supervisor)',
    required: false,
  })
  @IsOptional()
  @IsString()
  openedBy?: string;

  @ApiProperty({ description: 'Cajero asignado', required: false })
  @IsOptional()
  @IsString()
  cashierId?: string;

  @ApiProperty({ description: 'Notas de apertura', required: false })
  @IsOptional()
  @IsString()
  openingNotes?: string;
}
