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

        // Cost calculation for composed products
        if (createProductDto.type === 'COMPOSED' && createProductDto.components) {
            let totalCostInBase = 0;
            for (const component of createProductDto.components) {
                const product = await this.prisma.product.findUnique({
                    where: { id: component.componentProductId },
                    include: { currency: true }
                });
                if (product) {
                    const rate = product.currency?.isPrimary ? 1 : Number(product.currency?.exchangeRate || 1);
                    const costInBase = Number(product.costPrice || 0) * rate;
                    totalCostInBase += costInBase * Number(component.quantity);
                }
            }

            // Get target currency rate
            const targetCurrency = await this.prisma.currency.findUnique({
                where: { id: createProductDto.currencyId }
            });
            const targetRate = targetCurrency?.isPrimary ? 1 : Number(targetCurrency?.exchangeRate || 1);
            createProductDto.costPrice = totalCostInBase / targetRate;
        }

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
                    components: createProductDto.type === 'COMPOSED' && createProductDto.components
                        ? {
                            create: createProductDto.components.map(c => ({
                                componentProductId: c.componentProductId,
                                quantity: new Decimal(c.quantity)
                            }))
                        }
                        : undefined
                },
                include: {
                    category: { select: { id: true, name: true } },
                    subcategory: { select: { id: true, name: true } },
                    currency: { select: { id: true, name: true, symbol: true } },
                    unit: { select: { id: true, name: true, abbreviation: true } },
                    secondaryUnit: { select: { id: true, name: true, abbreviation: true } },
                    components: {
                        include: {
                            componentProduct: {
                                select: { id: true, name: true, sku: true, costPrice: true }
                            }
                        }
                    }
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
                currency: { select: { id: true, name: true, symbol: true, exchangeRate: true, isPrimary: true } },
                unit: { select: { id: true, name: true, abbreviation: true } },
                secondaryUnit: { select: { id: true, name: true, abbreviation: true } },
                components: {
                    include: {
                        componentProduct: {
                            include: { currency: true }
                        }
                    }
                }
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
                currency: { select: { id: true, name: true, symbol: true, exchangeRate: true, isPrimary: true } },
                unit: { select: { id: true, name: true, abbreviation: true } },
                components: {
                    include: {
                        componentProduct: {
                            include: { currency: true }
                        }
                    }
                }
            },
        });

        if (!product) {
            throw new NotFoundException(`Producto con ID ${id} no encontrado`);
        }

        return this.convertDecimalsToNumber(product);
    }

    async update(id: string, updateProductDto: UpdateProductDto) {
        const existingProduct = await this.findOne(id);

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

        // Detect cost change and calculate margins
        let costChangeInfo: any = null;
        if (updateProductDto.costPrice !== undefined) {
            const oldCost = Number(existingProduct.costPrice);
            const newCost = Number(updateProductDto.costPrice);
            const costChanged = Math.abs(oldCost - newCost) > 0.001;

            if (costChanged && oldCost > 0) {
                const salePrice = Number(existingProduct.salePrice);
                const offerPrice = existingProduct.offerPrice ? Number(existingProduct.offerPrice) : null;
                const wholesalePrice = existingProduct.wholesalePrice ? Number(existingProduct.wholesalePrice) : null;

                const salePriceMargin = salePrice > 0 ? ((salePrice - oldCost) / oldCost) * 100 : 0;
                const offerPriceMargin = offerPrice && offerPrice > 0 ? ((offerPrice - oldCost) / oldCost) * 100 : null;
                const wholesalePriceMargin = wholesalePrice && wholesalePrice > 0 ? ((wholesalePrice - oldCost) / oldCost) * 100 : null;

                costChangeInfo = {
                    productId: existingProduct.id,
                    productName: existingProduct.name,
                    oldCost,
                    newCost,
                    currentSalePrice: salePrice,
                    currentOfferPrice: offerPrice,
                    currentWholesalePrice: wholesalePrice,
                    salePriceMargin,
                    offerPriceMargin,
                    wholesalePriceMargin,
                    suggestedSalePrice: newCost * (1 + salePriceMargin / 100),
                    suggestedOfferPrice: offerPriceMargin !== null ? newCost * (1 + offerPriceMargin / 100) : null,
                    suggestedWholesalePrice: wholesalePriceMargin !== null ? newCost * (1 + wholesalePriceMargin / 100) : null,
                };
            }
        }

        // Cost calculation for composed products
        if (updateProductDto.type === 'COMPOSED' && updateProductDto.components) {
            let totalCostInBase = 0;
            for (const component of updateProductDto.components) {
                const product = await this.prisma.product.findUnique({
                    where: { id: component.componentProductId },
                    include: { currency: true }
                });
                if (product) {
                    const rate = product.currency?.isPrimary ? 1 : Number(product.currency?.exchangeRate || 1);
                    const costInBase = Number(product.costPrice || 0) * rate;
                    totalCostInBase += costInBase * Number(component.quantity);
                }
            }

            // Get target currency rate
            const targetCurrencyId = updateProductDto.currencyId || existingProduct.currencyId;
            const targetCurrency = await this.prisma.currency.findUnique({
                where: { id: targetCurrencyId }
            });
            const targetRate = targetCurrency?.isPrimary ? 1 : Number(targetCurrency?.exchangeRate || 1);
            updateProductDto.costPrice = totalCostInBase / targetRate;
        }

        try {
            // Update components if it's composed and components provided
            if (updateProductDto.type === 'COMPOSED' && updateProductDto.components) {
                // Delete existing components first (simple sync)
                await this.prisma.productComponent.deleteMany({
                    where: { compositeProductId: id }
                });

                // Prepare the create data
                const componentsData = updateProductDto.components.map(c => ({
                    componentProductId: c.componentProductId,
                    quantity: new Decimal(c.quantity)
                }));

                // Re-add them (we'll do this in the update transaction if possible, 
                // but deleteMany followed by nested create in update is sometimes cleaner)
            }

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
                    components: updateProductDto.type === 'COMPOSED' && updateProductDto.components
                        ? {
                            deleteMany: {},
                            create: updateProductDto.components.map(c => ({
                                componentProductId: c.componentProductId,
                                quantity: new Decimal(c.quantity)
                            }))
                        }
                        : undefined
                },
                include: {
                    category: { select: { id: true, name: true } },
                    subcategory: { select: { id: true, name: true } },
                    currency: { select: { id: true, name: true, symbol: true } },
                    unit: { select: { id: true, name: true, abbreviation: true } },
                    components: {
                        include: {
                            componentProduct: {
                                select: { id: true, name: true, sku: true, costPrice: true }
                            }
                        }
                    }
                },
            });

            const result = this.convertDecimalsToNumber(updatedProduct);

            // Include cost change info if detected
            if (costChangeInfo) {
                return {
                    ...result,
                    costChangeDetected: true,
                    costChangeInfo,
                };
            }

            return result;
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
        const results: Array<{
            success: boolean;
            product?: any;
            productId?: string;
            error?: string;
        }> = [];

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
