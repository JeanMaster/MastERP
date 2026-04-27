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
   * Creates a new client record.
   * @param createClientDto The data for the new client.
   * @returns The created client record.
   * @throws ConflictException if a client with the same ID already exists.
   */
  async create(createClientDto: CreateClientDto) {
    try {
      return await this.prisma.client.create({
        data: createClientDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A client with this ID is already registered',
        );
      }
      throw error;
    }
  }

  /**
   * Retrieves all clients with optional search filters.
   * @param search Search term (name, ID, or email).
   * @param active Filter by active/inactive status.
   * @returns A list of matching clients.
   */
  async findAll(search?: string, active: boolean = true) {
    const where: { active: boolean; OR?: any[] } = { active };

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
   * Retrieves a single client by its ID.
   * @param id The ID of the client.
   * @returns The client record.
   * @throws NotFoundException if the client is not found.
   */
  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  /**
   * Updates an existing client's information.
   * @param id The ID of the client to update.
   * @param updateClientDto The updated data.
   * @returns The updated client record.
   * @throws NotFoundException if the client doesn't exist.
   * @throws ConflictException if the new ID is already in use.
   */
  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id); // Verify existence

    try {
      return await this.prisma.client.update({
        where: { id },
        data: updateClientDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'This ID is already registered by another client',
        );
      }
      throw error;
    }
  }

  /**
   * Performs a soft delete by marking the client as inactive.
   * @param id The ID of the client to deactivate.
   * @returns The updated client record.
   */
  async remove(id: string) {
    await this.findOne(id); // Verify existence

    return this.prisma.client.update({
      where: { id },
      data: { active: false },
    });
  }
}
