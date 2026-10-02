import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { NearbyStoreDto, StoreDto } from '@indice/shared';
import type { Request, Response } from 'express';
import { DeviceId } from '../../device/device-id.decorator';
import { DeviceGuard } from '../../device/device.guard';
import { IdempotencyKey } from '../../idempotency/idempotency-key.decorator';
import { sendStored } from '../../idempotency/send-stored';
import { StoresService } from '../application/stores.service';
import { CreateStoreDto, NearbyStoresQueryDto, SearchStoresQueryDto } from './stores.dto';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('nearby')
  nearby(@Query() query: NearbyStoresQueryDto): Promise<NearbyStoreDto[]> {
    return this.stores.nearby(query.lat, query.lng, query.radius);
  }

  @Get('search')
  search(@Query() query: SearchStoresQueryDto): Promise<NearbyStoreDto[]> {
    return this.stores.search(query.q, query.lat, query.lng, query.radius);
  }

  @Post()
  @UseGuards(DeviceGuard)
  async create(
    @Body() dto: CreateStoreDto,
    @DeviceId() deviceId: string,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StoreDto> {
    return sendStored(res, await this.stores.create(dto, { deviceId, idempotencyKey, req }));
  }
}
