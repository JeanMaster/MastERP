import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum MovementType {
  OPENING = 'OPENING',
  SALE = 'SALE',
  EXPENSE = 'EXPENSE',
  DEPOSIT = 'DEPOSIT', // Transfer to bank/treasury
  WITHDRAWAL = 'WITHDRAWAL',
  ADJUSTMENT = 'ADJUSTMENT',
  CHANGE = 'CHANGE', // Given change
  CLOSING = 'CLOSING',
}

export class CreateMovementDto {
  @ApiProperty({ description: 'ID of the active cash session' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiProperty({ enum: MovementType, description: 'Type of cash movement' })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({ description: 'Amount of the movement' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'VES', description: 'Currency code' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiProperty({ required: false, description: 'Historical exchange rate' })
  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @ApiProperty({ description: 'Brief description of the movement' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ required: false, description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsString()
  saleId?: string;
}
