import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new measurement unit.
   * @param createUnitDto The data for the new unit.
   * @returns The created unit record.
   * @throws ConflictException if a unit with the same name already exists.
   */
  async create(createUnitDto: CreateUnitDto) {
    try {
      return await this.prisma.unit.create({
        data: createUnitDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('A unit with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Retrieves all units, optionally filtered by active status.
   * @param active Filter by active status.
   * @returns A list of units.
   */
  async findAll(active: boolean = true) {
    return this.prisma.unit.findMany({
      where: { active },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves a single measurement unit by its ID.
   * @param id The ID of the unit.
   * @returns The unit record.
   * @throws NotFoundException if the unit is not found.
   */
  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    return unit;
  }

  /**
   * Updates an existing measurement unit's information.
   * @param id The ID of the unit to update.
   * @param updateUnitDto The updated data.
   * @returns The updated unit record.
   * @throws ConflictException if the updated name already exists.
   */
  async update(id: string, updateUnitDto: UpdateUnitDto) {
    await this.findOne(id);

    try {
      return await this.prisma.unit.update({
        where: { id },
        data: updateUnitDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('A unit with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Performs a soft delete by marking the unit as inactive.
   * @param id The ID of the unit to deactivate.
   * @returns The updated unit record.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.unit.update({
      where: { id },
      data: { active: false },
    });
  }
}
