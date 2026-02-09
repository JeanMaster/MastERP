import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersController {
    constructor(private readonly suppliersService: SuppliersService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo proveedor' })
    @ApiResponse({ status: 201, description: 'Proveedor creado exitosamente' })
    @ApiResponse({ status: 409, description: 'RIF ya registrado' })
    create(@Body() createSupplierDto: CreateSupplierDto) {
        return this.suppliersService.create(createSupplierDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los proveedores' })
    @ApiQuery({ name: 'search', required: false, description: 'Buscar por nombre, RIF, email o contacto' })
    @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filtrar por activos' })
    findAll(
        @Query('search') search?: string,
        @Query('active') active?: string,
    ) {
        const isActive = active === undefined ? true : active === 'true';
        return this.suppliersService.findAll(search, isActive);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener un proveedor por ID' })
    @ApiResponse({ status: 200, description: 'Proveedor encontrado' })
    @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
    findOne(@Param('id') id: string) {
        return this.suppliersService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar un proveedor' })
    @ApiResponse({ status: 200, description: 'Proveedor actualizado' })
    @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
    update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
        return this.suppliersService.update(id, updateSupplierDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar un proveedor (soft delete)' })
    @ApiResponse({ status: 200, description: 'Proveedor marcado como inactivo' })
    @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
    remove(@Param('id') id: string) {
        return this.suppliersService.remove(id);
    }
}
