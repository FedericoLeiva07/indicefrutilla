import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FlagResponse, VoteResponse } from '@indice/shared';
import type { Request } from 'express';
import { DeviceId } from '../../device/device-id.decorator';
import { DeviceGuard } from '../../device/device.guard';
import { IpHasher } from '../../device/ip-hasher.service';
import { ReportParamsDto } from '../../reports/api/reports-query.dto';
import { CommunityService } from '../application/community.service';
import { FlagDto, VoteDto } from './community.dto';

@ApiTags('community')
@Controller('reports')
@UseGuards(DeviceGuard)
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly ipHasher: IpHasher,
  ) {}

  @Post(':id/votes')
  @HttpCode(201)
  vote(
    @Param() params: ReportParamsDto,
    @Body() dto: VoteDto,
    @DeviceId() deviceId: string,
    @Req() req: Request,
  ): Promise<VoteResponse> {
    return this.community.vote(params.id, dto.value, {
      deviceId,
      ipHash: this.ipHasher.hashRequest(req),
    });
  }

  @Post(':id/flags')
  @HttpCode(201)
  flag(
    @Param() params: ReportParamsDto,
    @Body() dto: FlagDto,
    @DeviceId() deviceId: string,
    @Req() req: Request,
  ): Promise<FlagResponse> {
    return this.community.flag(params.id, dto.reason, {
      deviceId,
      ipHash: this.ipHasher.hashRequest(req),
    });
  }
}
