
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export class CreateBankMovementDto {
    @IsNotEmpty()
    @IsString()
    bankAccountId: string;

    @IsNotEmpty()
    @IsEnum(['IN', 'OUT'])
    type: 'IN' | 'OUT';

    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    cashSessionId?: string;
}
