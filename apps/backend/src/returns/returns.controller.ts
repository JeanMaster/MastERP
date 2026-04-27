import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('returns')
@Controller('returns')
@UseGuards(AuthGuard('jwt'))
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  /**
   * Creates a new return request.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new return request' })
  @ApiResponse({ status: 201, description: 'Return created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or return not eligible',
  })
  create(@Body() createReturnDto: CreateReturnDto) {
    return this.returnsService.create(createReturnDto);
  }

  /**
   * Lists all returns with optional filters.
   */
  @Get()
  @ApiOperation({ summary: 'List returns with filters' })
  @ApiResponse({ status: 200, description: 'List of returns' })
  findAll(
    @Query('status') status?: string,
    @Query('returnType') returnType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (returnType) filters.returnType = returnType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    return this.returnsService.findAll(filters);
  }

  /**
   * Retrieves a single return by its ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a return by ID' })
  @ApiResponse({ status: 200, description: 'Return found' })
  @ApiResponse({ status: 404, description: 'Return not found' })
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  /**
   * Updates a return record.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a return record' })
  @ApiResponse({ status: 200, description: 'Return updated successfully' })
  update(@Param('id') id: string, @Body() updateReturnDto: UpdateReturnDto) {
    return this.returnsService.update(id, updateReturnDto);
  }

  /**
   * Approves a pending return.
   */
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending return' })
  @ApiResponse({ status: 200, description: 'Return approved successfully' })
  @ApiResponse({ status: 400, description: 'Return cannot be approved' })
  approve(@Param('id') id: string, @Body('approvedBy') approvedBy: string) {
    return this.returnsService.approve(id, approvedBy);
  }

  /**
   * Rejects a pending return.
   */
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending return' })
  @ApiResponse({ status: 200, description: 'Return rejected successfully' })
  @ApiResponse({ status: 400, description: 'Return cannot be rejected' })
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.returnsService.reject(id, reason);
  }

  /**
   * Processes an approved return (applies stock changes and finalizes).
   */
  @Post(':id/process')
  @ApiOperation({ summary: 'Process an approved return' })
  @ApiResponse({ status: 200, description: 'Return processed successfully' })
  @ApiResponse({ status: 400, description: 'Return cannot be processed' })
  process(@Param('id') id: string) {
    return this.returnsService.process(id);
  }

  /**
   * Validates whether a return is eligible before submission.
   */
  @Post('validate')
  @ApiOperation({ summary: 'Validate return eligibility' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  validate(@Body('saleId') saleId: string, @Body('items') items: any[]) {
    return this.returnsService.validateReturnEligibility(saleId, items);
  }
}
