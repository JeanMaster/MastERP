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

export class CloseSessionDto {
  @ApiProperty({ description: 'Actual balance found in the drawer' })
  @IsNumber()
  actualBalance: number;

  @ApiProperty({ required: false, description: 'Closing notes or observations' })
  @IsOptional()
  @IsString()
  closingNotes?: string;

  @ApiProperty({ type: [CashCountItemDto], required: false, description: 'Closing cash breakdown' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashCountItemDto)
  items?: CashCountItemDto[];

  @IsOptional()
  @IsString()
  closedBy?: string;
}
