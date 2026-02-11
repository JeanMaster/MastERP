import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export enum MovementType {
    SALE = 'SALE',
    EXPENSE = 'EXPENSE',
    DEPOSIT = 'DEPOSIT',
    WITHDRAWAL = 'WITHDRAWAL',
    OPENING = 'OPENING',
    CLOSING = 'CLOSING'
}

export class CreateMovementDto {
    @ApiProperty({ description: 'ID de la sesión de caja' })
    @IsString()
    sessionId: string;

    @ApiProperty({ enum: MovementType, description: 'Tipo de movimiento' })
    @IsEnum(MovementType)
    type: MovementType;

    @ApiProperty({ description: 'Monto del movimiento' })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ description: 'Código de moneda', default: 'VES' })
    @IsOptional()
    @IsString()
    currencyCode?: string;

    @ApiProperty({ description: 'Descripción del movimiento' })
    @IsString()
    description: string;

    @ApiProperty({ description: 'Notas adicionales', required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ description: 'Usuario que realiza', required: false })
    @IsOptional()
    @IsString()
    performedBy?: string;

    @ApiProperty({ description: 'ID de venta relacionada', required: false })
    @IsOptional()
    @IsString()
    saleId?: string;

    @ApiProperty({ description: 'Tasa de cambio histórica', required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;
}
