import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum AdjustmentType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export enum AdjustmentReason {
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  ERROR = 'ERROR',
  INITIAL = 'INITIAL',
  RETURN = 'RETURN',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'ID of the product being adjusted' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: AdjustmentType, description: 'Type of stock adjustment' })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({ description: 'Quantity to adjust (must be positive)', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ enum: AdjustmentReason, description: 'Reason for the adjustment' })
  @IsEnum(AdjustmentReason)
  reason: AdjustmentReason;

  @ApiProperty({ description: 'Additional notes or observations', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Username of the person performing the adjustment', required: false })
  @IsOptional()
  @IsString()
  performedBy?: string;
}
