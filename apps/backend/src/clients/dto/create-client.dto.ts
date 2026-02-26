import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3) // "V-1" at least
  id: string; // Manually provided ID

  @IsString()
  @IsNotEmpty()
  name: string; // Replaces comercialName/legalName

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  hasWhatsapp?: boolean;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  social1?: string;

  @IsString()
  @IsOptional()
  social2?: string;

  @IsString()
  @IsOptional()
  social3?: string;
}
