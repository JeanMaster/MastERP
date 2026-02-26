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
    example: 'Valery Corporativo',
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
}
