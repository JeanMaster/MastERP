import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo proveedor
   */
  async create(createSupplierDto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: createSupplierDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('El RIF ya está registrado');
      }
      throw error;
    }
  }

  /**
   * Listar todos los proveedores activos con filtros opcionales
   */
  async findAll(search?: string, active: boolean = true) {
    const where: any = { active };

    if (search) {
      where.OR = [
        { comercialName: { contains: search, mode: 'insensitive' } },
        { rif: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtener un proveedor por ID
   */
  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }

    return supplier;
  }

  /**
   * Actualizar un proveedor
   */
  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(id);

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: updateSupplierDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'El RIF ya está registrado por otro proveedor',
        );
      }
      throw error;
    }
  }

  /**
   * Soft delete: marcar como inactivo
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }
}
