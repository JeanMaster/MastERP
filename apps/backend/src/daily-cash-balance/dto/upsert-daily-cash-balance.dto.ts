import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertDailyCashBalanceDto {
  @ApiProperty({
    example: '2026-07-30',
    description: 'Day this closing balance belongs to (ISO date)',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 45000,
    description:
      'Total Bs on hand at closing: cash register + all Bs bank accounts combined',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  balance: number;

  @ApiProperty({ required: false, description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
