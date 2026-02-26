import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('hr/payroll')
@UseGuards(AuthGuard('jwt'))
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('period')
  createPeriod(@Body() createPayrollPeriodDto: CreatePayrollPeriodDto) {
    return this.payrollService.createPeriod(createPayrollPeriodDto);
  }

  @Get('period')
  findAllPeriods() {
    return this.payrollService.findAllPeriods();
  }

  @Get('period/:id')
  findOnePeriod(@Param('id') id: string) {
    return this.payrollService.findOnePeriod(id);
  }

  @Post('generate')
  generatePayroll(@Body() generatePayrollDto: GeneratePayrollDto) {
    return this.payrollService.generatePayroll(generatePayrollDto);
  }
}
