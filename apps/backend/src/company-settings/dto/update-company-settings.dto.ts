import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCompanySettingsDto {
  @ApiProperty({
    example: 'MastERP',
    description: 'Nombre de la empresa',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'J-12345678-9', description: 'RIF de la empresa' })
  @IsNotEmpty({ message: 'El RIF es requerido' })
  @IsString()
  rif: string;

  @ApiProperty({
    example: '/uploads/logo.png',
    required: false,
    description: 'URL del logo',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({
    example: 'uuid-123',
    required: false,
    description: 'ID de la moneda secundaria preferida',
  })
  @IsOptional()
  @IsString()
  preferredSecondaryCurrencyId?: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Activar actualización automática de tasas',
  })
  @IsOptional()
  @IsBoolean()
  autoUpdateRates?: boolean;

  @ApiProperty({
    example: 60,
    required: false,
    description: 'Frecuencia de actualización en minutos',
  })
  @IsOptional()
  @IsNumber()
  updateFrequency?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Activar cobro de IVA',
  })
  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @ApiProperty({
    example: 16.0,
    required: false,
    description: 'Tasa de IVA (%)',
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Activar redondeo de precios',
  })
  @IsOptional()
  @IsBoolean()
  roundingEnabled?: boolean;

  @ApiProperty({
    example: 10,
    required: false,
    description: 'Factor de redondeo (ej. 10, 100)',
  })
  @IsOptional()
  @IsNumber()
  roundingFactor?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Activar cobro de IGTF (3%)',
  })
  @IsOptional()
  @IsBoolean()
  igtfEnabled?: boolean;

  @ApiProperty({
    example: 3.0,
    required: false,
    description: 'Tasa de IGTF (%)',
  })
  @IsOptional()
  @IsNumber()
  igtfRate?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Estatus de Contribuyente Especial',
  })
  @IsOptional()
  @IsBoolean()
  isSpecialTaxpayer?: boolean;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Obligar a asignar cuenta bancaria en gastos y pagos',
  })
  @IsOptional()
  @IsBoolean()
  requireBankAccountForPayments?: boolean;
}
