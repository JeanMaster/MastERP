import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CashRegisterService } from './cash-register.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('cash-register')
@Controller('cash-register')
@UseGuards(AuthGuard('jwt'))
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Get('registers/main')
  @ApiOperation({ summary: 'Obtener o crear caja principal' })
  getMainRegister() {
    return this.cashRegisterService.getOrCreateMainRegister();
  }

  @Post('sessions/open')
  @ApiOperation({ summary: 'Abrir sesión de caja' })
  @ApiResponse({ status: 201, description: 'Sesión abierta exitosamente' })
  @ApiResponse({ status: 400, description: 'Ya existe una sesión abierta' })
  openSession(@Body() openSessionDto: OpenSessionDto) {
    return this.cashRegisterService.openSession(openSessionDto);
  }

  @Post('sessions/:id/close')
  @ApiOperation({ summary: 'Cerrar sesión de caja' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  closeSession(
    @Param('id') id: string,
    @Body() closeSessionDto: CloseSessionDto,
  ) {
    return this.cashRegisterService.closeSession(id, closeSessionDto);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Obtener sesión activa' })
  getActiveSession(
    @Query('registerId') registerId?: string,
    @Query('cashierId') cashierId?: string,
  ) {
    return this.cashRegisterService.getActiveSession(registerId, cashierId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Obtener detalles de sesión' })
  getSession(@Param('id') id: string) {
    return this.cashRegisterService.getSession(id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Listar sesiones' })
  listSessions(
    @Query('registerId') registerId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (registerId) filters.registerId = registerId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    return this.cashRegisterService.listSessions(filters);
  }

  @Post('movements')
  @ApiOperation({ summary: 'Crear movimiento de caja' })
  @ApiResponse({ status: 201, description: 'Movimiento creado' })
  @ApiResponse({ status: 400, description: 'Sesión cerrada o no encontrada' })
  createMovement(@Body() createMovementDto: CreateMovementDto) {
    return this.cashRegisterService.createMovement(createMovementDto);
  }

  @Post('sessions/:id/transfer-to-treasury')
  @ApiOperation({
    summary: 'Trasladar fondos de Caja a Tesorería (Banco/Bóveda)',
  })
  transferToTreasury(@Param('id') id: string, @Body() dto: any) {
    return this.cashRegisterService.transferToTreasury(
      id,
      dto.bankAccountId,
      dto.amount,
      dto.description,
      dto.performedBy || 'Sistema',
    );
  }

  @Post('sessions/:id/verify')
  @ApiOperation({ summary: 'Verificar sesión (Arqueo inicial)' })
  async verifySession(@Param('id') id: string, @Body() verifyDto: any) {
    return this.cashRegisterService.verifySession(id, verifyDto, 'Cajero');
  }

  @Post('sessions/:id/request-close')
  @ApiOperation({ summary: 'Solicitar cierre de caja (Arqueo de cierre)' })
  requestClose(@Param('id') id: string, @Body() closeDto: CloseSessionDto) {
    return this.cashRegisterService.requestCloseSession(id, closeDto);
  }

  @Post('sessions/:id/approve-close')
  @ApiOperation({ summary: 'Aprobar cierre de caja (Administrador)' })
  approveClose(@Param('id') id: string, @Body() body: { adminUser: string }) {
    return this.cashRegisterService.approveCloseSession(id, body.adminUser);
  }

  @Get('denominations')
  @ApiOperation({ summary: 'Obtener denominaciones de moneda' })
  getDenominations() {
    return this.cashRegisterService.getDenominations();
  }

  @Get('registers')
  @ApiOperation({ summary: 'Listar todas las cajas activas' })
  listRegisters() {
    return this.cashRegisterService.listRegisters();
  }

  @Post('registers')
  @ApiOperation({ summary: 'Crear una nueva caja' })
  createRegister(@Body() data: { name: string; location?: string }) {
    return this.cashRegisterService.createRegister(data);
  }

  @Patch('registers/:id')
  @ApiOperation({ summary: 'Actualizar una caja' })
  updateRegister(
    @Param('id') id: string,
    @Body() data: { name?: string; location?: string; isActive?: boolean },
  ) {
    return this.cashRegisterService.updateRegister(id, data);
  }

  @Delete('registers/:id')
  @ApiOperation({ summary: 'Eliminar una caja' })
  deleteRegister(@Param('id') id: string) {
    return this.cashRegisterService.deleteRegister(id);
  }
}
