import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../common/decorators/roles.decorator';

export class CreateUserDto {
  @ApiProperty({ example: 'jdoe', description: 'Unique username for login' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    example: 'secret123',
    minLength: 6,
    description: 'User password (hashed on creation)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'ADMIN',
    description: 'Role (ADMIN, MANAGER, CASHIER, SELLER)',
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(Role)
  role: Role;

  @ApiProperty({
    example: ['sales.create', 'products.view'],
    required: false,
    description: 'Specific granular permissions',
  })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether the user can log in',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
