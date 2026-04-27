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
  @ApiProperty({ example: 'Bolívar', description: 'Name of the currency' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'VES',
    description: 'Currency code (ISO 4217)',
  })
  @IsNotEmpty({ message: 'Code is required' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Bs', description: 'Currency symbol' })
  @IsNotEmpty({ message: 'Symbol is required' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: false, description: 'Whether this is the primary currency' })
  @IsBoolean()
  isPrimary: boolean;

  @ApiProperty({
    example: 100.0,
    required: false,
    description:
      'Exchange rate relative to the primary currency (only for secondary currencies)',
  })
  @ValidateIf((o) => !o.isPrimary && !o.isAutomatic)
  @IsNotEmpty({
    message: 'Exchange rate is required for manual secondary currencies',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'Exchange rate must be greater than 0' })
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({
    example: true,
    description: 'Whether the exchange rate updates automatically via API',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isAutomatic?: boolean;

  @ApiProperty({
    example: 'binance_p2p',
    description: 'Identifier for the external API provider',
    required: false,
  })
  @ValidateIf((o) => o.isAutomatic)
  @IsNotEmpty({
    message:
      'A data source must be selected for automatic updates',
  })
  @IsString()
  apiSymbol?: string;
}
