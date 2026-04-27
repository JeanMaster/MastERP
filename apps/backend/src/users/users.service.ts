import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new user record with a hashed password.
   * @param createUserDto Data for the new user.
   * @returns The created user record.
   */
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

  /**
   * Retrieves all user records, excluding sensitive data like passwords.
   * @returns A list of users.
   */
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
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves a single user record by its ID.
   * @param id The ID of the user.
   * @returns The user record.
   * @throws NotFoundException if the user is not found.
   */
  async findOne(id: string) {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Finds a user by their unique username.
   * @param username The username to search for.
   * @returns The user record or null if not found.
   */
  async findByUsername(username: string) {
    return (this.prisma as any).user.findUnique({ where: { username } });
  }

  /**
   * Updates an existing user record.
   * @param id The ID of the user to update.
   * @param updateUserDto The new data for the user.
   * @returns The updated user record.
   */
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

  /**
   * Deletes a user record.
   * Prevents the deletion of the primary 'admin' user.
   * @param id The ID of the user to delete.
   * @returns The deleted user record.
   */
  async remove(id: string) {
    const user = await this.findOne(id);
    if (user.username === 'admin') {
      throw new Error('The primary administrator user cannot be deleted');
    }
    return (this.prisma as any).user.delete({ where: { id } });
  }
}

