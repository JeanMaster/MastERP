import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreatePayrollPeriodDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
