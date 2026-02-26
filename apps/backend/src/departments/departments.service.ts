import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo departamento
   * Valida que solo haya 2 niveles de jerarquía (padre → hijo)
   */
  async create(createDepartmentDto: CreateDepartmentDto) {
    // Si tiene parentId, verificar que el padre no tenga padre (solo 2 niveles)
    if (createDepartmentDto.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: createDepartmentDto.parentId },
        select: { id: true, parentId: true, name: true },
      });

      if (!parent) {
        throw new NotFoundException('El departamento padre no existe');
      }

      if (parent.parentId) {
        throw new BadRequestException(
          'No se pueden crear subdepartamentos de subdepartamentos. Solo se permiten 2 niveles de jerarquía.',
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
   * Listar todos los departamentos activos
   * Incluye información de hijos y padre
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
        { parentId: 'asc' }, // Padres primero (nulls first)
        { name: 'asc' },
      ],
    });
  }

  /**
   * Obtener árbol de departamentos
   */
  async getTree() {
    const all = await this.findAll();

    // Filtrar solo los padres (sin parentId)
    const roots = all.filter((d) => !d.parentId);

    // Construir árbol
    return roots.map((root) => ({
      ...root,
      children: all.filter((d) => d.parentId === root.id),
    }));
  }

  /**
   * Obtener un departamento por ID
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
      throw new NotFoundException(`Departamento con ID ${id} no encontrado`);
    }

    return department;
  }

  /**
   * Actualizar un departamento
   * Valida jerarquía de 2 niveles
   */
  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    await this.findOne(id);

    // Si está cambiando el parentId, validar
    if (updateDepartmentDto.parentId !== undefined) {
      if (updateDepartmentDto.parentId) {
        // No puede asignarse a sí mismo como padre
        if (updateDepartmentDto.parentId === id) {
          throw new BadRequestException(
            'Un departamento no puede ser su propio padre',
          );
        }

        const parent = await this.prisma.department.findUnique({
          where: { id: updateDepartmentDto.parentId },
          select: { id: true, parentId: true },
        });

        if (!parent) {
          throw new NotFoundException('El departamento padre no existe');
        }

        if (parent.parentId) {
          throw new BadRequestException(
            'No se pueden crear subdepartamentos de subdepartamentos',
          );
        }

        // Verificar que el departamento actual no tenga hijos (no puede ser hijo si tiene hijos)
        const current = await this.prisma.department.findUnique({
          where: { id },
          include: { children: true },
        });

        if (current && current.children.length > 0) {
          throw new BadRequestException(
            'No se puede convertir en subdepartamento porque tiene subdepartamentos propios',
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
   * Eliminar un departamento (soft delete)
   * Si tiene hijos, los deja huérfanos (parentId = null)
   */
  async remove(id: string) {
    await this.findOne(id);

    // Primero, desconectar los hijos
    await this.prisma.department.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    // Luego hacer soft delete
    return this.prisma.department.update({
      where: { id },
      data: { active: false },
    });
  }
}
