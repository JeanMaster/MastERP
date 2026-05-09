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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully' })
  @ApiResponse({ status: 409, description: 'RIF already registered' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all suppliers' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, RIF, email, or contact',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  findAll(@Query('search') search?: string, @Query('active') active?: string) {
    const isActive = active === undefined ? true : active === 'true';
    return this.suppliersService.findAll(search, isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a supplier by ID' })
  @ApiResponse({ status: 200, description: 'Supplier found' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier updated' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a supplier (soft delete)' })
  @ApiResponse({ status: 200, description: 'Supplier marked as inactive' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
