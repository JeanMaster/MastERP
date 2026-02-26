import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'Bolívar', description: 'Nombre de la moneda' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'VES',
    description: 'Código de la moneda (ISO 4217)',
  })
  @IsNotEmpty({ message: 'El código es requerido' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Bs', description: 'Símbolo de la moneda' })
  @IsNotEmpty({ message: 'El símbolo es requerido' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: false, description: '¿Es la moneda principal?' })
  @IsBoolean()
  isPrimary: boolean;

  @ApiProperty({
    example: 100.0,
    required: false,
    description:
      'Tasa de cambio respecto a la moneda principal (solo para monedas secundarias)',
  })
  @ValidateIf((o) => !o.isPrimary && !o.isAutomatic)
  @IsNotEmpty({
    message: 'La tasa de cambio es requerida para monedas no automáticas',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'La tasa de cambio debe ser mayor a 0' })
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({
    example: true,
    description: '¿Se actualiza automáticamente?',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isAutomatic?: boolean;

  @ApiProperty({
    example: 'binance_p2p',
    description: 'Identificador para API externa',
    required: false,
  })
  @ValidateIf((o) => o.isAutomatic)
  @IsNotEmpty({
    message:
      'Debe seleccionar una fuente de datos para actualización automática',
  })
  @IsString()
  apiSymbol?: string;
}
