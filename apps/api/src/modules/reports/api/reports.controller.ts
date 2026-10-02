import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CreateReportResponse } from '@indice/shared';
import type { Request, Response } from 'express';
import { DeviceId } from '../../device/device-id.decorator';
import { DeviceGuard } from '../../device/device.guard';
import { IdempotencyKey } from '../../idempotency/idempotency-key.decorator';
import { sendStored } from '../../idempotency/send-stored';
import { ReportsService } from '../application/reports.service';
import { CreateReportDto } from './reports.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

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
