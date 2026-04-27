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
  @ApiProperty({ description: 'ID of the currency denomination' })
  @IsString()
  denominationId: string;

  @ApiProperty({ description: 'Quantity of banknotes/coins' })
  @IsNumber()
  quantity: number;
}

export class OpenSessionDto {
  @ApiProperty({ description: 'ID of the cash register' })
  @IsString()
  registerId: string;

  @ApiProperty({ required: false, description: 'Initial balance in base currency' })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @ApiProperty({ type: [CashCountItemDto], required: false, description: 'Initial cash breakdown' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashCountItemDto)
  items?: CashCountItemDto[];

  @ApiProperty({ required: false, description: 'Exchange rate used for opening' })
  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @ApiProperty({ required: false, description: 'Notes about the opening' })
  @IsOptional()
  @IsString()
  openingNotes?: string;

  @IsOptional()
  @IsString()
  openedBy?: string;

  @IsOptional()
  @IsString()
  cashierId?: string;
}
