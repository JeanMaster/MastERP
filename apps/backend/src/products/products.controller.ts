import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Creates a new product.
   */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 409, description: 'SKU already registered' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  /**
   * Retrieves a list of all products matching the filters.
   */
  @Get()
  @ApiOperation({ summary: 'List all products' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or SKU',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'subcategoryId',
    required: false,
    type: String,
    description: 'Filter by subcategory',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['PRODUCT', 'SERVICE'],
    description: 'Filter by product/service type',
  })
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

  /**
   * Retrieves a single product by its ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * Updates an existing product.
   */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * Deletes a product (soft delete).
   */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product (soft delete)' })
  @ApiResponse({ status: 200, description: 'Product marked as inactive' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  /**
   * Batch updates product prices using margin percentages.
   */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('batch-update-prices')
  @ApiOperation({
    summary: 'Batch update product sale prices using margins',
  })
  @ApiResponse({
    status: 200,
    description: 'Prices updated successfully',
  })
  batchUpdatePrices(
    @Body()
    updates: Array<{
      productId: string;
      newCostPrice: number;
      salePriceMargin: number;
      offerPriceMargin?: number;
      wholesalePriceMargin?: number;
      currencyId?: string;
    }>,
  ) {
    return this.productsService.batchUpdatePrices(updates);
  }
}

