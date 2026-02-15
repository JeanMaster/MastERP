import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    amount: number;

    @IsNotEmpty()
    @IsString()
    currencyCode: string;

    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    exchangeRate: number;

    @IsOptional()
    @IsDateString()
    date?: string;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsNotEmpty()
    @IsString()
    paymentMethod: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    bankAccountId?: string;
}
