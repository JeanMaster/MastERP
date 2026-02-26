import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CashCountItemDto {
  @ApiProperty()
  @IsString()
  denominationId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class VerifySessionDto {
  @ApiProperty({ type: [CashCountItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashCountItemDto)
  items: CashCountItemDto[];

  @ApiProperty()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Exchange rate used for USD' })
  @IsNumber()
  exchangeRate: number;
}
