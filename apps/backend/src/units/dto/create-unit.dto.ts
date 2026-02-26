import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitDto {
  @ApiProperty({ example: 'Caja', description: 'Nombre de la unidad' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'CJA', description: 'Abreviación de la unidad' })
  @IsNotEmpty({ message: 'La abreviación es requerida' })
  @IsString()
  abbreviation: string;
}
