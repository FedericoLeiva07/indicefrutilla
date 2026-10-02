import { Injectable } from '@nestjs/common';
import {
  type CreateReportResponse,
  ErrorCode,
  IndexLevel,
  type PriceOutOfRangeDetails,
  pricePerKg,
  resolveQuantityG,
  weekStart,
} from '@indice/shared';
import { AppException } from '../../../common/app-exception';
import { assertDailyLimit, REPORTS_DAILY_LIMIT } from '../../../common/daily-limit';
import { IpHasher } from '../../device/ip-hasher.service';
import { IdempotencyService, type StoredResponse } from '../../idempotency/idempotency.service';
import { PriceIndexQueries } from '../../price-index/infra/price-index.queries';
import { ReferenceService } from '../../reference/application/reference.service';
import type { WriteContext } from '../../stores/application/stores.service';
import { TurnstileService } from '../../turnstile/turnstile.service';
import type { CreateReportDto } from '../api/reports.dto';
import { ReportsQueries } from '../infra/reports.queries';

@Injectable()
export class ReportsService {
  constructor(
    private readonly queries: ReportsQueries,
    private readonly reference: ReferenceService,
    private readonly priceIndex: PriceIndexQueries,
    private readonly idempotency: IdempotencyService,
    private readonly turnstile: TurnstileService,
    private readonly ipHasher: IpHasher,
  ) {}

  async create(
    dto: CreateReportDto,
    ctx: WriteContext,
  ): Promise<StoredResponse<CreateReportResponse>> {
    const { turnstileToken, ...payload } = dto;
    const scope = {
      key: ctx.idempotencyKey,
      deviceId: ctx.deviceId,
      requestHash: IdempotencyService.hash('POST /reports', payload),
    };
    const previous = await this.idempotency.replay<CreateReportResponse>(scope);
    if (previous) return previous;

    await this.turnstile.assertHuman(turnstileToken, ctx.req);

    const zone = await this.queries.storeZone(dto.storeId);
    if (!zone) {
      throw new AppException(ErrorCode.StoreNotFound, 422, 'El comercio no existe');
    }

    const quantityG = resolveQuantityG(dto.presentation, dto.quantityG);
    if (quantityG === null) {
      throw new AppException(ErrorCode.ValidationFailed, 400, 'Falta la cantidad', [
        { field: 'quantityG', code: 'required' },
      ]);
    }
    const ppk = pricePerKg(dto.priceArs, quantityG);
    const { plausibleMin, plausibleMax } = await this.reference.latest();
    if (ppk < plausibleMin || ppk > plausibleMax) {
      const details: PriceOutOfRangeDetails = { plausibleMin, plausibleMax, pricePerKg: ppk };
      throw new AppException(
        ErrorCode.PriceOutOfRange,
        422,
        'El precio está fuera de lo habitual',
        details,
      );
    }

    const ipHash = this.ipHasher.hashRequest(ctx.req);
    return this.idempotency.run(scope, 201, async (em) => {
      await assertDailyLimit(em, REPORTS_DAILY_LIMIT, ctx.deviceId, ipHash);
      const report = await this.queries.insert(em, {
        storeId: dto.storeId,
        priceArs: dto.priceArs,
        presentation: dto.presentation,
        quantityG,
        pricePerKg: ppk,
        quality: dto.quality,
        observedAt: dto.observedAt,
        reporterName: dto.reporterName ?? null,
        deviceId: ctx.deviceId,
        ipHash,
      });
      const median = await this.priceIndex.publishedMedian(
        IndexLevel.Department,
        zone.departmentId,
        weekStart(dto.observedAt),
        em,
      );
      return {
        report,
        zone: { level: IndexLevel.Department, id: zone.departmentId, name: zone.departmentName },
        comparison:
          median === null
            ? null
            : { zoneMedian: median, diffPct: Math.round(((ppk - median) / median) * 100) },
      };
    });
  }
}
