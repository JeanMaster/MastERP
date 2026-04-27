import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class TransferToTreasuryDto {
  @ApiProperty({ description: 'Destination bank account ID' })
  @IsString()
  bankAccountId: string;

  @ApiProperty({ description: 'Amount to transfer' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Reason for the transfer' })
  @IsString()
  description: string;

  @ApiProperty({ required: false, description: 'Username of the person performing the transfer' })
  @IsString()
  performedBy?: string;
}
