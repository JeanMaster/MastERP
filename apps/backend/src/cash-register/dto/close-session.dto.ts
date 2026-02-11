import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CashCountItemDto } from './verify-session.dto';

export class CloseSessionDto {
    @ApiProperty({ description: 'Saldo real contado' })
    @IsNumber()
    @Min(0)
    actualBalance: number;

    @ApiProperty({ description: 'Usuario que cierra', required: false })
    @IsOptional()
    @IsString()
    closedBy?: string;

    @ApiProperty({ description: 'Notas de cierre', required: false })
    @IsOptional()
    @IsString()
    closingNotes?: string;

    @ApiProperty({ type: [CashCountItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CashCountItemDto)
    items?: CashCountItemDto[];

    @ApiProperty({ description: 'Exchange rate used for USD', required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;
}
