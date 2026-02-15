
import { IsString, IsNotEmpty, IsEnum, IsNumber, Min, IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBankAccountDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    bankName: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    accountNumber: string;

    @ApiProperty({ enum: ['CHECKING', 'SAVINGS'] })
    @IsNotEmpty()
    @IsString()
    accountType: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    holderName: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    holderId: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    currencyId: string;

    @ApiProperty()
    @IsOptional()
    @IsNumber()
    @Min(0)
    initialBalance?: number;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    receivesPosLiquidation?: boolean;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    receivesMobilePayment?: boolean;
}
