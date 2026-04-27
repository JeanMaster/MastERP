import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  Length,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'J-98765432-1',
    description: 'Supplier RIF (unique)',
  })
  @IsNotEmpty({ message: 'RIF is required' })
  @IsString()
  @Length(6, 15, { message: 'RIF must be between 6 and 15 characters' })
  rif: string;

  @ApiProperty({
    example: 'ABC Distributors',
    description: 'Commercial name',
  })
  @IsNotEmpty({ message: 'Commercial name is required' })
  @IsString()
  comercialName: string;

  @ApiProperty({ example: 'ABC Distributors C.A.', required: false })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({
    example: 'John Smith',
    required: false,
    description: 'Contact person name',
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ example: 'Industrial Zone, Caracas', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '+58 212-9876543', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'sales@abcdistributors.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiProperty({
    example: 'Materials',
    required: false,
    description: 'Supplier category',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Supplier status (active/inactive)',
  })
  @IsOptional()
  @IsBoolean({ message: 'Status must be a boolean value' })
  active?: boolean;
}
