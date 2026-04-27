import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new department.
   * Validates that there are only 2 levels of hierarchy (Parent → Child).
   * @param createDepartmentDto The data for the new department.
   * @returns The created department record.
   */
  async create(createDepartmentDto: CreateDepartmentDto) {
    // If it has a parentId, verify that the parent doesn't have a parent itself (limit to 2 levels)
    if (createDepartmentDto.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: createDepartmentDto.parentId },
        select: { id: true, parentId: true, name: true },
      });

      if (!parent) {
        throw new NotFoundException('Parent department not found');
      }

      if (parent.parentId) {
        throw new BadRequestException(
          'Cannot create sub-departments of sub-departments. Only 2 levels of hierarchy are allowed.',
        );
      }
    }

    try {
      return await this.prisma.department.create({
        data: createDepartmentDto,
        include: {
          parent: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves all active departments.
   * Includes information about parent and child departments.
   * @param active Filter by active status (defaults to true).
   * @returns A list of departments.
   */
  async findAll(active: boolean = true) {
    return this.prisma.department.findMany({
      where: { active },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          where: { active },
          select: { id: true, name: true, description: true },
        },
      },
      orderBy: [
        { parentId: 'asc' }, // Parents first (nulls first)
        { name: 'asc' },
      ],
    });
  }

  /**
   * Retrieves the department hierarchy tree.
   * @returns A tree structure of departments.
   */
  async getTree() {
    const all = await this.findAll();

    // Filter only roots (no parentId)
    const roots = all.filter((d) => !d.parentId);

    // Build the tree
    return roots.map((root) => ({
      ...root,
      children: all.filter((d) => d.parentId === root.id),
    }));
  }

  /**
   * Retrieves a single department by its ID.
   * @param id The ID of the department.
   * @returns The department record with full relationships.
   */
  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return department;
  }

  /**
   * Updates an existing department.
   * Validates the 2-level hierarchy constraint.
   * @param id The ID of the department to update.
   * @param updateDepartmentDto The updated data.
   * @returns The updated department record.
   */
  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    await this.findOne(id); // Ensure existence

    // If changing the parentId, validate constraints
    if (updateDepartmentDto.parentId !== undefined) {
      if (updateDepartmentDto.parentId) {
        // Cannot be its own parent
        if (updateDepartmentDto.parentId === id) {
          throw new BadRequestException('A department cannot be its own parent');
        }

        const parent = await this.prisma.department.findUnique({
          where: { id: updateDepartmentDto.parentId },
          select: { id: true, parentId: true },
        });

        if (!parent) {
          throw new NotFoundException('Parent department not found');
        }

        if (parent.parentId) {
          throw new BadRequestException(
            'Cannot create sub-departments of sub-departments',
          );
        }

        // Verify that the current department doesn't have children (cannot become a child if it's already a parent)
        const current = await this.prisma.department.findUnique({
          where: { id },
          include: { children: true },
        });

        if (current && current.children.length > 0) {
          throw new BadRequestException(
            'Cannot convert to a sub-department because it has its own sub-departments',
          );
        }
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
      include: {
        parent: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Deactivates a department (soft delete).
   * Orphans children by setting their parentId to null.
   * @param id The ID of the department to deactivate.
   * @returns The deactivated department record.
   */
  async remove(id: string) {
    await this.findOne(id);

    // Orphan children first
    await this.prisma.department.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    // Mark as inactive
    return this.prisma.department.update({
      where: { id },
      data: { active: false },
    });
  }
}
