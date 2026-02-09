import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('currencies')
@Controller('currencies')
@UseGuards(AuthGuard('jwt'))
export class CurrenciesController {
    constructor(private readonly currenciesService: CurrenciesService) { }

    @Post()
    @ApiOperation({ summary: 'Crear una nueva moneda' })
    @ApiResponse({ status: 201, description: 'Moneda creada' })
    create(@Body() createCurrencyDto: CreateCurrencyDto) {
        return this.currenciesService.create(createCurrencyDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas las monedas' })
    @ApiResponse({ status: 200, description: 'Lista de monedas' })
    findAll() {
        return this.currenciesService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener una moneda por ID' })
    @ApiResponse({ status: 200, description: 'Moneda encontrada' })
    findOne(@Param('id') id: string) {
        return this.currenciesService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar una moneda' })
    @ApiResponse({ status: 200, description: 'Moneda actualizada' })
    update(@Param('id') id: string, @Body() updateCurrencyDto: UpdateCurrencyDto) {
        return this.currenciesService.update(id, updateCurrencyDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar una moneda (soft delete)' })
    @ApiResponse({ status: 200, description: 'Moneda eliminada' })
    remove(@Param('id') id: string) {
        return this.currenciesService.remove(id);
    }
}
