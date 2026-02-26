import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
