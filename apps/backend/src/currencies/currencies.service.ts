import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CurrenciesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new currency.
   * Handles primary currency logic (only one can be primary).
   * @param createCurrencyDto The data for the new currency.
   * @returns The created currency record.
   * @throws BadRequestException if manual secondary currency lacks an exchange rate.
   * @throws ConflictException if name or code already exists.
   */
  async create(createCurrencyDto: CreateCurrencyDto) {
    // Validate primary currency logic
    if (createCurrencyDto.isPrimary) {
      // Unmark any other primary currency
      await this.prisma.currency.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    } else {
      // Validate exchange rate for manual secondary currencies
      if (!createCurrencyDto.isAutomatic && !createCurrencyDto.exchangeRate) {
        throw new BadRequestException(
          'Manual secondary currencies require an exchange rate',
        );
      }
    }

    try {
      return await this.prisma.currency.create({
        data: {
          ...createCurrencyDto,
          exchangeRate:
            createCurrencyDto.isPrimary || !createCurrencyDto.exchangeRate
              ? null
              : new Decimal(createCurrencyDto.exchangeRate),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A currency with this name or code already exists',
        );
      }
      throw error;
    }
  }

  /**
   * Retrieves all currencies, optionally filtered by active status.
   * @param active Filter by active status.
   * @returns A list of currencies with exchange rate as number.
   */
  async findAll(active: boolean = true) {
    const currencies = await this.prisma.currency.findMany({
      where: { active },
      orderBy: [
        { isPrimary: 'desc' }, // Primary first
        { name: 'asc' },
      ],
    });

    // Convert Decimal to number for frontend compatibility
    return currencies.map((currency) => ({
      ...currency,
      exchangeRate: currency.exchangeRate
        ? Number(currency.exchangeRate)
        : null,
    }));
  }

  /**
   * Retrieves a single currency by its ID.
   * @param id The ID of the currency.
   * @returns The currency record with exchange rate as number.
   * @throws NotFoundException if the currency is not found.
   */
  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    return {
      ...currency,
      exchangeRate: currency.exchangeRate
        ? Number(currency.exchangeRate)
        : null,
    };
  }

  /**
   * Updates an existing currency's information.
   * @param id The ID of the currency to update.
   * @param updateCurrencyDto The updated data.
   * @returns The updated currency record.
   */
  async update(id: string, updateCurrencyDto: UpdateCurrencyDto) {
    await this.findOne(id);

    // If being marked as primary
    if (updateCurrencyDto.isPrimary === true) {
      // Unmark any other primary currency
      await this.prisma.currency.updateMany({
        where: {
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    // Validate exchange rate requirements
    const isPrimary =
      updateCurrencyDto.isPrimary ?? (await this.findOne(id)).isPrimary;
    const isAutomatic =
      updateCurrencyDto.isAutomatic ?? (await this.findOne(id)).isAutomatic;

    if (isPrimary === false && isAutomatic === false) {
      const currentCurrency = await this.findOne(id);
      const hasNewRate =
        updateCurrencyDto.exchangeRate !== undefined &&
        updateCurrencyDto.exchangeRate !== null;
      const hasExistingRate = currentCurrency.exchangeRate !== null;

      if (!hasNewRate && !hasExistingRate) {
        throw new BadRequestException(
          'Manual secondary currencies require an exchange rate',
        );
      }
    }

    try {
      const updatedCurrency = await this.prisma.currency.update({
        where: { id },
        data: {
          ...updateCurrencyDto,
          exchangeRate: updateCurrencyDto.isPrimary
            ? null
            : updateCurrencyDto.exchangeRate
              ? new Decimal(updateCurrencyDto.exchangeRate)
              : undefined,
        },
      });

      return {
        ...updatedCurrency,
        exchangeRate: updatedCurrency.exchangeRate
          ? Number(updatedCurrency.exchangeRate)
          : null,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A currency with this name or code already exists',
        );
      }
      throw error;
    }
  }

  /**
   * Performs a soft delete by marking the currency as inactive.
   * Prevents deleting the primary currency if others are active.
   * @param id The ID of the currency to deactivate.
   * @returns The updated currency record.
   */
  async remove(id: string) {
    const currency = await this.findOne(id);

    // Don't allow deleting the primary currency if others are active
    if (currency.isPrimary) {
      const count = await this.prisma.currency.count({
        where: { active: true },
      });

      if (count > 1) {
        throw new BadRequestException(
          'Cannot delete the primary currency. Mark another currency as primary first.',
        );
      }
    }

    return this.prisma.currency.update({
      where: { id },
      data: { active: false },
    });
  }
}
