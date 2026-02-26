import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto, PaymentFrequency } from './create-employee.dto';
import { IsBoolean, IsOptional, IsEnum } from 'class-validator';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PaymentFrequency)
  paymentFrequency?: PaymentFrequency;
}
