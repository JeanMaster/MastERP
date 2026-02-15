
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LiquidatePosBatchDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    bankAccountId: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    commissionAmount: number;

    @ApiProperty()
    @IsOptional()
    @IsString()
    notes?: string;
}
