import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async createPeriod(createPayrollPeriodDto: CreatePayrollPeriodDto) {
    return (this.prisma as any).payrollPeriod.create({
      data: {
        name: createPayrollPeriodDto.name,
        startDate: new Date(createPayrollPeriodDto.startDate),
        endDate: new Date(createPayrollPeriodDto.endDate),
        status: 'DRAFT',
      },
    });
  }

  async findAllPeriods() {
    return (this.prisma as any).payrollPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async findOnePeriod(id: string) {
    const period = await (this.prisma as any).payrollPeriod.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
            employee: true,
            items: true,
          },
        },
      },
    });
    if (!period) throw new NotFoundException(`Payroll Period ${id} not found`);
    return period;
  }

  async generatePayroll(generatePayrollDto: GeneratePayrollDto) {
    const periodId = generatePayrollDto.payrollPeriodId;
    const period = await this.findOnePeriod(periodId);

    if (period.status === 'PAID') {
      throw new BadRequestException('Cannot regenerate a PAID payroll period');
    }

    // Fetch eligible employees
    const whereClause: any = { isActive: true };

    if (
      generatePayrollDto.employeeIds &&
      generatePayrollDto.employeeIds.length > 0
    ) {
      whereClause.id = { in: generatePayrollDto.employeeIds };
    }

    if (generatePayrollDto.frequency) {
      whereClause.paymentFrequency = generatePayrollDto.frequency;
    }

    const employees = await (this.prisma as any).employee.findMany({
      where: whereClause,
    });

    if (employees.length === 0) {
      throw new BadRequestException('No eligible employees found');
    }

    // Transaction for generation
    return await (this.prisma as any).$transaction(async (tx: any) => {
      // Delete existing payments for this period if re-generating
      await tx.payrollPayment.deleteMany({
        where: { payrollPeriodId: periodId },
      });

      const newPayments: any[] = [];
      let grandTotal = 0;

      for (const emp of employees) {
        // Simplified Logic: Base Salary is monthly.
        // If period is typically 15 days, we might want to split?
        // For now, let's assume the user inputs the full BaseSalary as monthly,
        // and we pay the full amount? OR half?
        // Requirement said "Cálculo automático base".
        // Let's assume standard semi-monthly payment (Quincenal) implies half salary?
        // To be safe and simple: We will apply the FULL baseSalary and let the user edit, OR
        // we calculate based on days?
        // Let's implement: Salary / 2 (Assuming semi-monthly rule usually).
        // Actually, safer to just put BaseSalary and user can adjust.
        // Let's stick to BaseSalary / 2 (Quincena) as a default heuristic if name contains "Quincena"?
        // No, let's just pay BaseSalary for now as 'Salary', and maybe we add a 'Quantity' logic later.
        // *Decision*: Pay 50% of BaseSalary by default (common in LatAm for Quincena).

        let incomeAmount = 0;
        let description = 'Sueldo Base';

        // Calculate based on frequency
        // Default handling if paymentFrequency is missing (should be BIWEEKLY by db default)
        const freq = emp.paymentFrequency || 'BIWEEKLY';

        switch (freq) {
          case 'WEEKLY':
            incomeAmount = Number(emp.baseSalary) / 4;
            description = 'Sueldo Base (Semanal)';
            break;
          case 'BIWEEKLY':
            incomeAmount = Number(emp.baseSalary) / 2;
            description = 'Sueldo Base (Quincenal)';
            break;
          case 'MONTHLY':
            incomeAmount = Number(emp.baseSalary);
            description = 'Sueldo Base (Mensual)';
            break;
          default:
            incomeAmount = Number(emp.baseSalary) / 2;
            description = 'Sueldo Base';
        }

        // const incomeAmount = Number(emp.baseSalary) / 2;

        const payment = await tx.payrollPayment.create({
          data: {
            payrollPeriodId: periodId,
            employeeId: emp.id,
            baseSalary: emp.baseSalary,
            currency: emp.currency,
            exchangeRate: 1, // Default, should come from system
            totalIncome: incomeAmount,
            totalDeductions: 0,
            netAmount: incomeAmount,
            items: {
              create: [
                {
                  type: 'INCOME',
                  description: description,
                  amount: incomeAmount,
                },
              ],
            },
          },
        });
        newPayments.push(payment);
        grandTotal += incomeAmount;
      }

      // Update Period Status
      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: {
          status: 'PROCESSED',
          totalAmount: grandTotal,
        },
      });

      return { count: newPayments.length, totalAmount: grandTotal };
    });
  }
}
