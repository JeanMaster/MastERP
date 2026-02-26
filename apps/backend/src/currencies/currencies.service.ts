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

  async create(createCurrencyDto: CreateCurrencyDto) {
    // Validar lógica de moneda principal
    if (createCurrencyDto.isPrimary) {
      // Desmarcar cualquier otra moneda principal
      await this.prisma.currency.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    } else {
      // Validar que tenga tasa de cambio si no es automática
      if (!createCurrencyDto.isAutomatic && !createCurrencyDto.exchangeRate) {
        throw new BadRequestException(
          'Las monedas secundarias manuales requieren tasa de cambio',
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
          'Ya existe una moneda con ese nombre o código',
        );
      }
      throw error;
    }
  }

  async findAll(active: boolean = true) {
    const currencies = await this.prisma.currency.findMany({
      where: { active },
      orderBy: [
        { isPrimary: 'desc' }, // Principal primero
        { name: 'asc' },
      ],
    });

    // Convertir Decimal a number
    return currencies.map((currency) => ({
      ...currency,
      exchangeRate: currency.exchangeRate
        ? Number(currency.exchangeRate)
        : null,
    }));
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!currency) {
      throw new NotFoundException(`Moneda con ID ${id} no encontrada`);
    }

    return {
      ...currency,
      exchangeRate: currency.exchangeRate
        ? Number(currency.exchangeRate)
        : null,
    };
  }

  async update(id: string, updateCurrencyDto: UpdateCurrencyDto) {
    await this.findOne(id);

    // Si se está marcando como principal
    if (updateCurrencyDto.isPrimary === true) {
      // Desmarcar cualquier otra moneda principal
      await this.prisma.currency.updateMany({
        where: {
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    // Validar tasa de cambio
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
          'Las monedas secundarias manuales requieren tasa de cambio',
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
          'Ya existe una moneda con ese nombre o código',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    const currency = await this.findOne(id);

    // No permitir eliminar la moneda principal si hay otras monedas
    if (currency.isPrimary) {
      const count = await this.prisma.currency.count({
        where: { active: true },
      });

      if (count > 1) {
        throw new BadRequestException(
          'No se puede eliminar la moneda principal. Primero marca otra moneda como principal.',
        );
      }
    }

    return this.prisma.currency.update({
      where: { id },
      data: { active: false },
    });
  }
}
