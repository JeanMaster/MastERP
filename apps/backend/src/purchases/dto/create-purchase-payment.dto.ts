
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchasePaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    purchaseId: string;

    @ApiProperty()
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    paymentMethod: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    paymentAmount?: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    currencyCode?: string;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    exchangeRate?: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    bankAccountId?: string;
}
