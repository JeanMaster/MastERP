import { IsString, IsOptional, IsArray, IsNotEmpty, IsNumber, Min, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSaleItemDto {
    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    unitPrice: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    total: number;
}

export class CreateSaleDto {
    @IsString()
    @IsOptional()
    clientId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSaleItemDto)
    items: CreateSaleItemDto[];

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    subtotal: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    discount: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    tax: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    total: number;

    @IsString()
    paymentMethod: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsOptional()
    tendered?: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsOptional()
    change?: number;

    @IsString()
    @IsOptional()
    invoiceNumber?: string;

    @IsNumber({ maxDecimalPlaces: 4 })
    @IsOptional()
    exchangeRate?: number;

    @IsString()
    @IsOptional()
    cashSessionId?: string;
}