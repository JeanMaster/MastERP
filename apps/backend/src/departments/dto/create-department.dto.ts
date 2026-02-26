import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Ferretería',
    description: 'Nombre del departamento',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Departamento de herramientas y materiales',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'uuid-del-departamento-padre',
    required: false,
    description: 'ID del departamento padre (solo 1 nivel permitido)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
