import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return (this.prisma as any).user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        permissions: createUserDto.permissions || [],
      },
    });
  }

  async findAll() {
    return (this.prisma as any).user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        // Exclude password
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string) {
    return (this.prisma as any).user.findUnique({ where: { username } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return (this.prisma as any).user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    if (user.username === 'admin') {
      throw new Error(
        'No se puede eliminar el usuario administrador principal',
      );
    }
    return (this.prisma as any).user.delete({ where: { id } });
  }
}
