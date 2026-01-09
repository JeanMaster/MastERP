import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(createProductDto: CreateProductDto) {
        // Validar que la subcategoría sea hija de la categoría
        if (createProductDto.subcategoryId) {
            const subcategory = await this.prisma.department.findUnique({
                where: { id: createProductDto.subcategoryId },
                select: { parentId: true },
            });

            if (!subcategory || subcategory.parentId !== createProductDto.categoryId) {
                throw new BadRequestException(
                    'La subcategoría seleccionada no pertenece a la categoría especificada',
                );
            }
        }

        // Validar que los precios de venta sean >= precio de costo
        this.validatePrices(createProductDto);

        try {
            return await this.prisma.product.create({
                data: {
                    ...createProductDto,
                    type: createProductDto.type || 'PRODUCT', // Default logic
                    costPrice: createProductDto.costPrice
                        ? new Decimal(createProductDto.costPrice)
                        : null,
                    salePrice: new Decimal(createProductDto.salePrice),
                    offerPrice: createProductDto.offerPrice
                        ? new Decimal(createProductDto.offerPrice)
                        : null,
                    wholesalePrice: createProductDto.wholesalePrice
                        ? new Decimal(createProductDto.wholesalePrice)
                        : null,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    subcategory: { select: { id: true, name: true } },
                    currency: { select: { id: true, name: true, symbol: true } },
                    unit: { select: { id: true, name: true, abbreviation: true } },
                    secondaryUnit: { select: { id: true, name: true, abbreviation: true } },
                },
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('error sku duplicado');
            }
            throw error;
        }
    }

    async findAll(options: { active?: boolean; search?: string; categoryId?: string; subcategoryId?: string; type?: 'PRODUCT' | 'SERVICE' } = {}) {
        const { active = true, search, categoryId, subcategoryId, type } = options;

        const where: any = { active };

        if (type) {
            where.type = type;
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (subcategoryId) {
            where.subcategoryId = subcategoryId;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ];
        }

        const products = await this.prisma.product.findMany({
            where,
            include: {
                category: { select: { id: true, name: true } },
                subcategory: { select: { id: true, name: true } },
                currency: { select: { id: true, name: true, symbol: true } },
                unit: { select: { id: true, name: true, abbreviation: true } },
                secondaryUnit: { select: { id: true, name: true, abbreviation: true } },
            },
            orderBy: { name: 'asc' },
        });

        return products.map((product) => this.convertDecimalsToNumber(product));
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: { select: { id: true, name: true } },
                subcategory: { select: { id: true, name: true } },
                currency: { select: { id: true, name: true, symbol: true } },
                unit: { select: { id: true, name: true, abbreviation: true } },
            },
        });

        if (!product) {
            throw new NotFoundException(`Producto con ID ${id} no encontrado`);
        }

        return this.convertDecimalsToNumber(product);
    }

    async update(id: string, updateProductDto: UpdateProductDto) {
        await this.findOne(id);

        // Validar subcategoría si está presente
        if (updateProductDto.subcategoryId && updateProductDto.categoryId) {
            const subcategory = await this.prisma.department.findUnique({
                where: { id: updateProductDto.subcategoryId },
                select: { parentId: true },
            });

            if (!subcategory || subcategory.parentId !== updateProductDto.categoryId) {
                throw new BadRequestException(
                    'La subcategoría seleccionada no pertenece a la categoría especificada',
                );
            }
        }

        // Validar precios
        if (
            updateProductDto.costPrice !== undefined ||
            updateProductDto.salePrice !== undefined ||
            updateProductDto.offerPrice !== undefined ||
            updateProductDto.wholesalePrice !== undefined
        ) {
            this.validatePrices(updateProductDto);
        }

        try {
            const updatedProduct = await this.prisma.product.update({
                where: { id },
                data: {
                    ...updateProductDto,
                    costPrice: updateProductDto.costPrice
                        ? new Decimal(updateProductDto.costPrice)
                        : undefined,
                    salePrice: updateProductDto.salePrice
                        ? new Decimal(updateProductDto.salePrice)
                        : undefined,
                    offerPrice: updateProductDto.offerPrice
                        ? new Decimal(updateProductDto.offerPrice)
                        : undefined,
                    wholesalePrice: updateProductDto.wholesalePrice
                        ? new Decimal(updateProductDto.wholesalePrice)
                        : undefined,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    subcategory: { select: { id: true, name: true } },
                    currency: { select: { id: true, name: true, symbol: true } },
                    unit: { select: { id: true, name: true, abbreviation: true } },
                },
            });

            return this.convertDecimalsToNumber(updatedProduct);
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('error sku duplicado');
            }
            throw error;
        }
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.product.update({
            where: { id },
            data: { active: false },
        });
    }

    // Validar que los precios de venta sean >= costo
    private validatePrices(dto: CreateProductDto | UpdateProductDto) {
        // Si es servicio, el costo puede ser irrelevante, pero asumimos 0 para validar que precio venta > 0
        const costPrice = dto.costPrice || 0;

        if (dto.salePrice !== undefined && dto.salePrice < costPrice) {
            // Nota: Para servicios, costPrice es 0, así que salePrice solo debe ser >= 0
            if (costPrice > 0 || dto.salePrice < 0) {
                throw new BadRequestException(
                    'El precio de venta no puede ser menor al precio de costo',
                );
            }
        }

        // ... (resto igual, costPrice es 0 si undefined)
        if (dto.offerPrice !== undefined && dto.offerPrice < costPrice) {
            if (costPrice > 0 || dto.offerPrice < 0) {
                throw new BadRequestException(
                    'El precio en oferta no puede ser menor al precio de costo',
                );
            }
        }

        if (dto.wholesalePrice !== undefined && dto.wholesalePrice < costPrice) {
            if (costPrice > 0 || dto.wholesalePrice < 0) {
                throw new BadRequestException(
                    'El precio al mayor no puede ser menor al precio de costo',
                );
            }
        }
    }

    // Convertir Decimals a Numbers para JSON
    private convertDecimalsToNumber(product: any) {
        return {
            ...product,
            costPrice: Number(product.costPrice),
            salePrice: Number(product.salePrice),
            offerPrice: product.offerPrice ? Number(product.offerPrice) : null,
            wholesalePrice: product.wholesalePrice ? Number(product.wholesalePrice) : null,
            secondaryCostPrice: product.secondaryCostPrice ? Number(product.secondaryCostPrice) : null,
            secondarySalePrice: product.secondarySalePrice ? Number(product.secondarySalePrice) : null,
            secondaryOfferPrice: product.secondaryOfferPrice ? Number(product.secondaryOfferPrice) : null,
            secondaryWholesalePrice: product.secondaryWholesalePrice ? Number(product.secondaryWholesalePrice) : null,
            stock: Number(product.stock),
            unitsPerSecondaryUnit: product.unitsPerSecondaryUnit ? Number(product.unitsPerSecondaryUnit) : null,
        };
    }

    /**
     * Batch update product prices using margin percentages
     */
    async batchUpdatePrices(updates: Array<{
        productId: string;
        newCostPrice: number;
        salePriceMargin: number;
        offerPriceMargin?: number;
        wholesalePriceMargin?: number;
    }>) {
        const results = [];

        for (const update of updates) {
            const { productId, newCostPrice, salePriceMargin, offerPriceMargin, wholesalePriceMargin } = update;

            // Calculate new prices based on margins
            const newSalePrice = newCostPrice * (1 + salePriceMargin / 100);
            const newOfferPrice = offerPriceMargin !== undefined && offerPriceMargin !== null
                ? newCostPrice * (1 + offerPriceMargin / 100)
                : null;
            const newWholesalePrice = wholesalePriceMargin !== undefined && wholesalePriceMargin !== null
                ? newCostPrice * (1 + wholesalePriceMargin / 100)
                : null;

            try {
                const updatedProduct = await this.prisma.product.update({
                    where: { id: productId },
                    data: {
                        costPrice: new Decimal(newCostPrice),
                        salePrice: new Decimal(newSalePrice),
                        offerPrice: newOfferPrice ? new Decimal(newOfferPrice) : null,
                        wholesalePrice: newWholesalePrice ? new Decimal(newWholesalePrice) : null,
                    },
                    select: {
                        id: true,
                        name: true,
                        costPrice: true,
                        salePrice: true,
                        offerPrice: true,
                        wholesalePrice: true,
                    }
                });

                results.push({
                    success: true,
                    product: this.convertDecimalsToNumber(updatedProduct),
                });
            } catch (error) {
                results.push({
                    success: false,
                    productId,
                    error: error.message,
                });
            }
        }

        return {
            updated: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        };
    }
}
