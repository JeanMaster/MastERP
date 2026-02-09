import { IsString, IsEmail, IsOptional, IsNotEmpty, Length, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierDto {
    @ApiProperty({ example: 'J-98765432-1', description: 'RIF del proveedor (único)' })
    @IsNotEmpty({ message: 'El RIF es requerido' })
    @IsString()
    @Length(6, 15, { message: 'El RIF debe tener entre 6 y 15 caracteres' })
    rif: string;

    @ApiProperty({ example: 'Distribuidora ABC', description: 'Nombre comercial' })
    @IsNotEmpty({ message: 'El nombre comercial es requerido' })
    @IsString()
    comercialName: string;

    @ApiProperty({ example: 'Distribuidora ABC C.A.', required: false })
    @IsOptional()
    @IsString()
    legalName?: string;

    @ApiProperty({ example: 'Juan Pérez', required: false, description: 'Nombre del contacto' })
    @IsOptional()
    @IsString()
    contactName?: string;

    @ApiProperty({ example: 'Zona Industrial, Caracas', required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ example: '+58 212-9876543', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'ventas@distribuidoraabc.com', required: false })
    @IsOptional()
    @IsEmail({}, { message: 'Email inválido' })
    email?: string;

    @ApiProperty({ example: 'Materiales', required: false, description: 'Categoría del proveedor' })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({ example: true, required: false, description: 'Estado del proveedor (activo/inactivo)' })
    @IsOptional()
    @IsBoolean({ message: 'El estado debe ser un valor booleano' })
    active?: boolean;
}
