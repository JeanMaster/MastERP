import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo cliente
   */
  async create(createClientDto: CreateClientDto) {
    try {
      return await this.prisma.client.create({
        data: createClientDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'El Cliente con este ID ya está registrado',
        );
      }
      throw error;
    }
  }

  /**
   * Listar todos los clientes activos con filtros opcionales
   */
  async findAll(search?: string, active: boolean = true) {
    const where: any = { active };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtener un cliente por ID
   */
  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  /**
   * Actualizar un cliente
   */
  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id); // Verifica que existe

    try {
      return await this.prisma.client.update({
        where: { id },
        data: updateClientDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'El ID ya está registrado por otro cliente',
        );
      }
      throw error;
    }
  }

  /**
   * Soft delete: marcar como inactivo
   */
  async remove(id: string) {
    await this.findOne(id); // Verifica que existe

    return this.prisma.client.update({
      where: { id },
      data: { active: false },
    });
  }
}
