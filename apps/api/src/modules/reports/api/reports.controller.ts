import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CreateReportResponse, ReportItemDto, ReportListDto } from '@indice/shared';
import type { Request, Response } from 'express';
import { DeviceId } from '../../device/device-id.decorator';
import { DeviceGuard } from '../../device/device.guard';
import { IdempotencyKey } from '../../idempotency/idempotency-key.decorator';
import { sendStored } from '../../idempotency/send-stored';
import { ReportsReadService } from '../application/reports-read.service';
import { ReportsService } from '../application/reports.service';
import { ListReportsQueryDto, ReportParamsDto } from './reports-query.dto';
import { CreateReportDto } from './reports.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly reader: ReportsReadService,
  ) {}

  @Get()
  list(@Query() query: ListReportsQueryDto): Promise<ReportListDto> {
    return this.reader.list(query);
  }

  @Get(':id')
  detail(@Param() params: ReportParamsDto): Promise<ReportItemDto> {
    return this.reader.detail(params.id);
  }

  @Post()
  @UseGuards(DeviceGuard)
  async create(
    @Body() dto: CreateReportDto,
    @DeviceId() deviceId: string,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateReportResponse> {
    return sendStored(res, await this.reports.create(dto, { deviceId, idempotencyKey, req }));
  }
}
