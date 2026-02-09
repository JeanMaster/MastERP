
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

export class TransferToTreasuryDto {
    @ApiProperty({ description: 'ID de la cuenta bancaria o bóveda de destino' })
    @IsString()
    bankAccountId: string;

    @ApiProperty({ description: 'Monto a trasladar' })
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty({ description: 'Descripción o motivo del traslado' })
    @IsString()
    description: string;

    @ApiProperty({ description: 'Usuario que realiza el traslado (opcional)' })
    @IsString()
    performedBy?: string;
}
