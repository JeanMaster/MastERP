import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [EmployeesModule, PayrollModule],
})
export class HrModule {}
