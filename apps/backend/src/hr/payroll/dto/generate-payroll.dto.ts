import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { PaymentFrequency } from '../../employees/dto/create-employee.dto';

export class GeneratePayrollDto {
  @IsNotEmpty()
  @IsString()
  payrollPeriodId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsEnum(PaymentFrequency)
  frequency?: PaymentFrequency;
}
