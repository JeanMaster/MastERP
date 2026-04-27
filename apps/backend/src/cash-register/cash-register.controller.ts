import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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

  /**
   * Retrieves the main cash register.
   */
  @Get('main')
  @ApiOperation({ summary: 'Get the main cash register' })
  getMainRegister() {
    return this.cashRegisterService.getOrCreateMainRegister();
  }

  /**
   * Retrieves all cash registers.
   */
  @Get('registers')
  @ApiOperation({ summary: 'List all cash registers' })
  findAllRegisters() {
    return this.cashRegisterService.listRegisters();
  }

  /**
   * Creates a new cash register.
   */
  @Post('registers')
  @ApiOperation({ summary: 'Create a new cash register' })
  createRegister(@Body() data: { name: string; location?: string }) {
    return this.cashRegisterService.createRegister(data);
  }

  /**
   * Updates a cash register.
   */
  @Patch('registers/:id')
  @ApiOperation({ summary: 'Update a cash register' })
  updateRegister(
    @Param('id') id: string,
    @Body() data: { name?: string; location?: string; isActive?: boolean },
  ) {
    return this.cashRegisterService.updateRegister(id, data);
  }

  /**
   * Deletes a cash register.
   */
  @Delete('registers/:id')
  @ApiOperation({ summary: 'Delete a cash register' })
  deleteRegister(@Param('id') id: string) {
    return this.cashRegisterService.deleteRegister(id);
  }

  /**
   * Retrieves active denominations.
   */
  @Get('denominations')
  @ApiOperation({ summary: 'Get active currency denominations' })
  getDenominations() {
    return this.cashRegisterService.getDenominations();
  }

  /**
   * Retrieves the active session.
   */
  @Get('sessions/active')
  @ApiOperation({ summary: 'Get the active cash session' })
  @ApiQuery({ name: 'registerId', required: false })
  getActiveSession(
    @Query('registerId') registerId?: string,
    @Request() req?: any,
  ) {
    return this.cashRegisterService.getActiveSession(
      registerId,
      req.user.role !== 'ADMIN' ? req.user.id : undefined,
    );
  }

  /**
   * Opens a new cash session.
   */
  @Post('sessions/open')
  @ApiOperation({ summary: 'Open a new cash session' })
  openSession(@Body() openSessionDto: OpenSessionDto, @Request() req) {
    return this.cashRegisterService.openSession({
      ...openSessionDto,
      openedBy: req.user.username,
      cashierId: req.user.id,
    });
  }

  /**
   * Verifies an open session.
   */
  @Post('sessions/:id/verify')
  @ApiOperation({ summary: 'Verify an open session (Opening audit)' })
  verifySession(@Param('id') id: string, @Body() verifyDto: any, @Request() req) {
    return this.cashRegisterService.verifySession(id, verifyDto, req.user.username);
  }

  /**
   * Directly closes a cash session.
   */
  @Post('sessions/:id/close')
  @ApiOperation({ summary: 'Directly close a cash session' })
  closeSession(@Param('id') id: string, @Body() closeDto: CloseSessionDto) {
    return this.cashRegisterService.closeSession(id, closeDto);
  }

  /**
   * Requests a session closure.
   */
  @Post('sessions/:id/request-close')

  @ApiOperation({ summary: 'Request a session closure' })
  requestClose(@Param('id') id: string, @Body() closeDto: CloseSessionDto) {
    return this.cashRegisterService.requestCloseSession(id, closeDto);
  }

  /**
   * Approves a session closure.
   */
  @Post('sessions/:id/approve-close')
  @ApiOperation({ summary: 'Approve a session closure (Admin)' })
  approveClose(@Param('id') id: string, @Request() req) {
    return this.cashRegisterService.approveCloseSession(id, req.user.username);
  }

  /**
   * Registers a manual cash movement.
   */
  @Post('movement')
  @ApiOperation({ summary: 'Record a manual cash movement' })
  createMovement(@Body() createMovementDto: CreateMovementDto, @Request() req) {
    return this.cashRegisterService.createMovement({
      ...createMovementDto,
      performedBy: req.user.username,
    });
  }

  /**
   * Transfers funds to treasury.
   */
  @Post('sessions/:id/transfer-treasury')
  @ApiOperation({ summary: 'Transfer funds from cash to treasury' })
  transferToTreasury(
    @Param('id') id: string,
    @Body() dto: { bankAccountId: string; amount: number; description: string },
    @Request() req,
  ) {
    return this.cashRegisterService.transferToTreasury(
      id,
      dto.bankAccountId,
      dto.amount,
      dto.description,
      req.user.username,
    );
  }

  /**
   * Lists all sessions.
   */
  @Get('sessions')
  @ApiOperation({ summary: 'List all cash sessions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'registerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  listSessions(
    @Query('status') status?: string,
    @Query('registerId') registerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashRegisterService.listSessions({
      status,
      registerId,
      startDate,
      endDate,
    });
  }

  /**
   * Retrieves a single session by ID.
   */
  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a session by ID' })
  getSession(@Param('id') id: string) {
    return this.cashRegisterService.getSession(id);
  }

}
