import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('products')
@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo producto' })
    @ApiResponse({ status: 201, description: 'Producto creado exitosamente' })
    @ApiResponse({ status: 409, description: 'SKU ya registrado' })
    create(@Body() createProductDto: CreateProductDto) {
        return this.productsService.create(createProductDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los productos' })
    @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filtrar por activos' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nombre o SKU' })
    @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filtrar por categoría' })
    @ApiQuery({ name: 'subcategoryId', required: false, type: String, description: 'Filtrar por subcategoría' })
    @ApiQuery({ name: 'type', required: false, enum: ['PRODUCT', 'SERVICE'], description: 'Filtrar por tipo de producto/servicio' })
    findAll(
        @Query('active') active?: string,
        @Query('search') search?: string,
        @Query('categoryId') categoryId?: string,
        @Query('subcategoryId') subcategoryId?: string,
        @Query('type') type?: 'PRODUCT' | 'SERVICE',
    ) {
        const isActive = active === undefined ? true : active === 'true';
        return this.productsService.findAll({
            active: isActive,
            search,
            categoryId,
            subcategoryId,
            type,
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener un producto por ID' })
    @ApiResponse({ status: 200, description: 'Producto encontrado' })
    @ApiResponse({ status: 404, description: 'Producto no encontrado' })
    findOne(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar un producto' })
    @ApiResponse({ status: 200, description: 'Producto actualizado' })
    @ApiResponse({ status: 404, description: 'Producto no encontrado' })
    update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
        return this.productsService.update(id, updateProductDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar un producto (soft delete)' })
    @ApiResponse({ status: 200, description: 'Producto marcado como inactivo' })
    @ApiResponse({ status: 404, description: 'Producto no encontrado' })
    remove(@Param('id') id: string) {
        return this.productsService.remove(id);
    }

    @Post('batch-update-prices')
    @ApiOperation({ summary: 'Actualizar precios de venta en lote usando márgenes' })
    @ApiResponse({ status: 200, description: 'Precios actualizados exitosamente' })
    batchUpdatePrices(@Body() updates: Array<{
        productId: string;
        newCostPrice: number;
        salePriceMargin: number;
        offerPriceMargin?: number;
        wholesalePriceMargin?: number;
        currencyId?: string;
    }>) {
        return this.productsService.batchUpdatePrices(updates);
    }
}
