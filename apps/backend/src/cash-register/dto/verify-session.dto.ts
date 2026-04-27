import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CashCountItemDto } from './open-session.dto';

export class VerifySessionDto {
  @ApiProperty({ type: [CashCountItemDto], description: 'Audit cash breakdown' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashCountItemDto)
  items: CashCountItemDto[];

  @ApiProperty({ required: false, description: 'Audit notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Current exchange rate for foreign currency audit' })
  @IsNumber()
  exchangeRate: number;
}
