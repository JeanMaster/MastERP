import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    return (this.prisma as any).employee.create({
      data: {
        firstName: createEmployeeDto.firstName,
        lastName: createEmployeeDto.lastName,
        identification: createEmployeeDto.identification,
        email: createEmployeeDto.email,
        phone: createEmployeeDto.phone,
        address: createEmployeeDto.address,
        position: createEmployeeDto.position,
        department: createEmployeeDto.department,
        baseSalary: createEmployeeDto.baseSalary,
        currency: createEmployeeDto.currency,
        isActive: createEmployeeDto.isActive,
        paymentFrequency: createEmployeeDto.paymentFrequency,
        userId: createEmployeeDto.userId || undefined,
      },
    });
  }

  async findAll() {
    return (this.prisma as any).employee.findMany({
      orderBy: {
        lastName: 'asc',
      },
      include: {
        user: { select: { username: true } },
      },
    });
  }

  async findOne(id: string) {
    const employee = await (this.prisma as any).employee.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    await this.findOne(id); // Check existence

    return (this.prisma as any).employee.update({
      where: { id },
      data: {
        firstName: updateEmployeeDto.firstName,
        lastName: updateEmployeeDto.lastName,
        identification: updateEmployeeDto.identification,
        email: updateEmployeeDto.email,
        phone: updateEmployeeDto.phone,
        address: updateEmployeeDto.address,
        position: updateEmployeeDto.position,
        department: updateEmployeeDto.department,
        baseSalary: updateEmployeeDto.baseSalary,
        currency: updateEmployeeDto.currency,
        userId: updateEmployeeDto.userId,
        isActive: updateEmployeeDto.isActive,
        paymentFrequency: updateEmployeeDto.paymentFrequency,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence
    // Soft delete usually better, but for now specific delete or deactivate
    return (this.prisma as any).employee.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
