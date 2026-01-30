import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('returns')
@Controller('returns')
@UseGuards(AuthGuard('jwt'))
export class ReturnsController {
    constructor(private readonly returnsService: ReturnsService) { }

    @Post()
    @ApiOperation({ summary: 'Crear una nueva devolución' })
    @ApiResponse({ status: 201, description: 'Devolución creada exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o devolución no elegible' })
    create(@Body() createReturnDto: CreateReturnDto) {
        return this.returnsService.create(createReturnDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar devoluciones con filtros' })
    @ApiResponse({ status: 200, description: 'Lista de devoluciones' })
    findAll(
        @Query('status') status?: string,
        @Query('returnType') returnType?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        const filters: any = {};
        if (status) filters.status = status;
        if (returnType) filters.returnType = returnType;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        return this.returnsService.findAll(filters);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener una devolución por ID' })
    @ApiResponse({ status: 200, description: 'Devolución encontrada' })
    @ApiResponse({ status: 404, description: 'Devolución no encontrada' })
    findOne(@Param('id') id: string) {
        return this.returnsService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar una devolución' })
    @ApiResponse({ status: 200, description: 'Devolución actualizada' })
    update(@Param('id') id: string, @Body() updateReturnDto: UpdateReturnDto) {
        return this.returnsService.update(id, updateReturnDto);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Aprobar una devolución pendiente' })
    @ApiResponse({ status: 200, description: 'Devolución aprobada' })
    @ApiResponse({ status: 400, description: 'La devolución no puede ser aprobada' })
    approve(
        @Param('id') id: string,
        @Body('approvedBy') approvedBy: string
    ) {
        return this.returnsService.approve(id, approvedBy);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Rechazar una devolución pendiente' })
    @ApiResponse({ status: 200, description: 'Devolución rechazada' })
    @ApiResponse({ status: 400, description: 'La devolución no puede ser rechazada' })
    reject(
        @Param('id') id: string,
        @Body('reason') reason: string
    ) {
        return this.returnsService.reject(id, reason);
    }

    @Post(':id/process')
    @ApiOperation({ summary: 'Procesar una devolución aprobada' })
    @ApiResponse({ status: 200, description: 'Devolución procesada exitosamente' })
    @ApiResponse({ status: 400, description: 'La devolución no puede ser procesada' })
    process(@Param('id') id: string) {
        return this.returnsService.process(id);
    }

    @Post('validate')
    @ApiOperation({ summary: 'Validar elegibilidad de devolución' })
    @ApiResponse({ status: 200, description: 'Resultado de validación' })
    validate(
        @Body('saleId') saleId: string,
        @Body('items') items: any[]
    ) {
        return this.returnsService.validateReturnEligibility(saleId, items);
    }
}
