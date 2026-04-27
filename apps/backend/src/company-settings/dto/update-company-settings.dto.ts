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
    description: 'Company name',
  })
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'J-12345678-9', description: 'Company RIF (tax ID)' })
  @IsNotEmpty({ message: 'RIF is required' })
  @IsString()
  rif: string;

  @ApiProperty({
    example: '/uploads/logo.png',
    required: false,
    description: 'Logo URL',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({
    example: 'uuid-123',
    required: false,
    description: 'ID of the preferred secondary currency',
  })
  @IsOptional()
  @IsString()
  preferredSecondaryCurrencyId?: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Enable automatic exchange rate updates',
  })
  @IsOptional()
  @IsBoolean()
  autoUpdateRates?: boolean;

  @ApiProperty({
    example: 60,
    required: false,
    description: 'Rate update frequency in minutes',
  })
  @IsOptional()
  @IsNumber()
  updateFrequency?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Enable VAT (IVA) collection',
  })
  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @ApiProperty({
    example: 16.0,
    required: false,
    description: 'VAT rate (%)',
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Enable price rounding',
  })
  @IsOptional()
  @IsBoolean()
  roundingEnabled?: boolean;

  @ApiProperty({
    example: 10,
    required: false,
    description: 'Rounding factor (e.g., 10, 100)',
  })
  @IsOptional()
  @IsNumber()
  roundingFactor?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Enable IGTF collection (3% foreign currency tax)',
  })
  @IsOptional()
  @IsBoolean()
  igtfEnabled?: boolean;

  @ApiProperty({
    example: 3.0,
    required: false,
    description: 'IGTF rate (%)',
  })
  @IsOptional()
  @IsNumber()
  igtfRate?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Special Taxpayer (Contribuyente Especial) status',
  })
  @IsOptional()
  @IsBoolean()
  isSpecialTaxpayer?: boolean;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Require bank account assignment for expenses and payments',
  })
  @IsOptional()
  @IsBoolean()
  requireBankAccountForPayments?: boolean;
}
