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

  /**
   * Creates a new payroll period.
   */
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

  /**
   * Retrieves all payroll periods ordered by start date descending.
   */
  async findAllPeriods() {
    return (this.prisma as any).payrollPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Retrieves a single payroll period by its ID including payments.
   */
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

  /**
   * Generates payroll payments for all eligible employees in a given period.
   * Salary is split based on payment frequency:
   *   - WEEKLY: BaseSalary / 4
   *   - BIWEEKLY: BaseSalary / 2
   *   - MONTHLY: BaseSalary (full amount)
   */
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

    // Use a transaction to generate all payments atomically
    return await (this.prisma as any).$transaction(async (tx: any) => {
      // Delete existing payments for this period if re-generating
      await tx.payrollPayment.deleteMany({
        where: { payrollPeriodId: periodId },
      });

      const newPayments: any[] = [];
      let grandTotal = 0;

      for (const emp of employees) {
        // Calculate income amount based on payment frequency.
        // BIWEEKLY = half month salary (most common in LatAm - "Quincena").
        // The user can edit individual payment items after generation.
        let incomeAmount = 0;
        let description = 'Base Salary';

        // Default to BIWEEKLY if frequency is missing (matches DB default)
        const freq = emp.paymentFrequency || 'BIWEEKLY';

        switch (freq) {
          case 'WEEKLY':
            incomeAmount = Number(emp.baseSalary) / 4;
            description = 'Base Salary (Weekly)';
            break;
          case 'BIWEEKLY':
            incomeAmount = Number(emp.baseSalary) / 2;
            description = 'Base Salary (Biweekly)';
            break;
          case 'MONTHLY':
            incomeAmount = Number(emp.baseSalary);
            description = 'Base Salary (Monthly)';
            break;
          default:
            incomeAmount = Number(emp.baseSalary) / 2;
            description = 'Base Salary';
        }

        const payment = await tx.payrollPayment.create({
          data: {
            payrollPeriodId: periodId,
            employeeId: emp.id,
            baseSalary: emp.baseSalary,
            currency: emp.currency,
            exchangeRate: 1, // Default; should be fetched from system settings
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

      // Update period status to PROCESSED
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
