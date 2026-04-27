import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Hardware',
    description: 'Name of the department',
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Department for tools and materials',
    required: false,
    description: 'Department description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'uuid-of-parent-department',
    required: false,
    description: 'ID of the parent department (only 1 level of nesting allowed)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
