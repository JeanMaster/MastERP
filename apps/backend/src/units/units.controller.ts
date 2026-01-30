import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('units')
@Controller('units')
@UseGuards(AuthGuard('jwt'))
export class UnitsController {
    constructor(private readonly unitsService: UnitsService) { }

    @Post()
    @ApiOperation({ summary: 'Crear una nueva unidad' })
    @ApiResponse({ status: 201, description: 'Unidad creada' })
    create(@Body() createUnitDto: CreateUnitDto) {
        return this.unitsService.create(createUnitDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas las unidades' })
    @ApiResponse({ status: 200, description: 'Lista de unidades' })
    findAll() {
        return this.unitsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener una unidad por ID' })
    @ApiResponse({ status: 200, description: 'Unidad encontrada' })
    findOne(@Param('id') id: string) {
        return this.unitsService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar una unidad' })
    @ApiResponse({ status: 200, description: 'Unidad actualizada' })
    update(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
        return this.unitsService.update(id, updateUnitDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar una unidad (soft delete)' })
    @ApiResponse({ status: 200, description: 'Unidad eliminada' })
    remove(@Param('id') id: string) {
        return this.unitsService.remove(id);
    }
}
