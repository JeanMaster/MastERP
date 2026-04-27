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
   * Creates a new supplier record.
   * @param createSupplierDto The data for the new supplier.
   * @returns The created supplier record.
   * @throws ConflictException if the RIF is already registered.
   */
  async create(createSupplierDto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: createSupplierDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('RIF already registered');
      }
      throw error;
    }
  }

  /**
   * Retrieves all suppliers with optional search filters.
   * @param search Search term (name, RIF, email, or contact).
   * @param active Filter by active/inactive status.
   * @returns A list of matching suppliers.
   */
  async findAll(search?: string, active: boolean = true) {
    const where: { active: boolean; OR?: any[] } = { active };

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
   * Retrieves a single supplier by its ID.
   * @param id The ID of the supplier.
   * @returns The supplier record.
   * @throws NotFoundException if the supplier is not found.
   */
  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  /**
   * Updates an existing supplier's information.
   * @param id The ID of the supplier to update.
   * @param updateSupplierDto The updated data.
   * @returns The updated supplier record.
   * @throws NotFoundException if the supplier doesn't exist.
   * @throws ConflictException if the new RIF is already in use.
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
          'RIF already registered by another supplier',
        );
      }
      throw error;
    }
  }

  /**
   * Performs a soft delete by marking the supplier as inactive.
   * @param id The ID of the supplier to deactivate.
   * @returns The updated supplier record.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }
}
