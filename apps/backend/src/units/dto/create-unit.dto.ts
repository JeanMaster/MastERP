import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitDto {
  @ApiProperty({ example: 'Box', description: 'Name of the measurement unit' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'BX', description: 'Abbreviation of the measurement unit' })
  @IsNotEmpty({ message: 'Abbreviation is required' })
  @IsString()
  abbreviation: string;
}
