import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type NearbyStoreDto,
  type StoreDto,
  type StoreDuplicateDetails,
} from '@indice/shared';
import type { Request } from 'express';
import { AppException } from '../../../common/app-exception';
import { assertDailyLimit, STORES_DAILY_LIMIT } from '../../../common/daily-limit';
import { IpHasher } from '../../device/ip-hasher.service';
import { GeoService } from '../../geo/application/geo.service';
import { IdempotencyService, type StoredResponse } from '../../idempotency/idempotency.service';
import { TurnstileService } from '../../turnstile/turnstile.service';
import type { CreateStoreDto } from '../api/stores.dto';
import { normalizeStoreName } from '../domain/normalize-name';
import { StoresQueries } from '../infra/stores.queries';

export interface WriteContext {
  deviceId: string;
  idempotencyKey: string | undefined;
  req: Request;
}

@Injectable()
export class StoresService {
  constructor(
    private readonly queries: StoresQueries,
    private readonly geo: GeoService,
    private readonly idempotency: IdempotencyService,
    private readonly turnstile: TurnstileService,
    private readonly ipHasher: IpHasher,
  ) {}

  nearby(lat: number, lng: number, radius: number): Promise<NearbyStoreDto[]> {
    return this.queries.nearby(lat, lng, radius);
  }

  async search(q: string, lat: number, lng: number, radius: number): Promise<NearbyStoreDto[]> {
    const normalized = normalizeStoreName(q);
    if (normalized.length < 2) return [];
    return this.queries.search(normalized, lat, lng, radius);
  }

  async create(dto: CreateStoreDto, ctx: WriteContext): Promise<StoredResponse<StoreDto>> {
    const { turnstileToken, ...payload } = dto;
    const scope = {
      key: ctx.idempotencyKey,
      deviceId: ctx.deviceId,
      requestHash: IdempotencyService.hash('POST /stores', payload),
    };
    const previous = await this.idempotency.replay<StoreDto>(scope);
    if (previous) return previous;

    await this.turnstile.assertHuman(turnstileToken, ctx.req);
    const zone = await this.geo.resolve(dto.lat, dto.lng);
    const nameNormalized = normalizeStoreName(dto.name);
    if (nameNormalized.length < 2) {
      throw new AppException(ErrorCode.ValidationFailed, 400, 'El nombre no es válido', [
        { field: 'name', code: 'isLength' },
      ]);
    }
    const ipHash = this.ipHasher.hashRequest(ctx.req);

    return this.idempotency.run(scope, 201, async (em) => {
      await assertDailyLimit(em, STORES_DAILY_LIMIT, ctx.deviceId, ipHash);
      if (!dto.confirmedDistinct) {
        const candidates = await this.queries.possibleDuplicates(
          em,
          nameNormalized,
          dto.lat,
          dto.lng,
        );
        if (candidates.length > 0) {
          const details: StoreDuplicateDetails = { candidates };
          throw new AppException(
            ErrorCode.StorePossibleDuplicate,
            409,
            'Ya hay un comercio parecido muy cerca',
            details,
          );
        }
      }
      return this.queries.insert(em, {
        name: dto.name,
        nameNormalized,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        provinceId: zone.province.id,
        departmentId: zone.department.id,
        deviceId: ctx.deviceId,
        ipHash,
      });
    });
  }
}
