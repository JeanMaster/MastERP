import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum AdjustmentType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export enum AdjustmentReason {
  DAMAGE = 'DAMAGE', // Producto dañado
  LOSS = 'LOSS', // Pérdida/robo
  ERROR = 'ERROR', // Error de conteo
  INITIAL = 'INITIAL', // Inventario inicial
  RETURN = 'RETURN', // Devolución al stock
  TRANSFER = 'TRANSFER', // Transferencia
  OTHER = 'OTHER', // Otro
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: AdjustmentType, description: 'Tipo de ajuste' })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({ description: 'Cantidad a ajustar', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: AdjustmentReason, description: 'Razón del ajuste' })
  @IsEnum(AdjustmentReason)
  reason: AdjustmentReason;

  @ApiProperty({ description: 'Notas adicionales', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Usuario que realiza', required: false })
  @IsOptional()
  @IsString()
  performedBy?: string;
}
