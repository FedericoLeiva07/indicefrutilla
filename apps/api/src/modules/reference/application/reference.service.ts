import { Injectable } from '@nestjs/common';
import {
  argentinaDate,
  REFERENCE_SOURCE,
  type ReferenceLatestDto,
  shiftDate,
} from '@indice/shared';
import { type Env, InjectEnv } from '../../../config/config.module';
import { ReferenceQueries } from '../infra/reference.queries';

export const PLAUSIBLE_FACTORS = { min: 0.7, max: 4 } as const;
export const REFERENCE_MAX_AGE_DAYS = 14;

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ReferenceService {
  constructor(
    private readonly queries: ReferenceQueries,
    @InjectEnv() private readonly env: Env,
  ) {}

  async latest(now: Date = new Date()): Promise<ReferenceLatestDto> {
    const current = await this.queries.current();
    const oldestAccepted = shiftDate(argentinaDate(now), -REFERENCE_MAX_AGE_DAYS);
    if (!current || current.date < oldestAccepted) {
      return {
        date: null,
        modalPpk: null,
        plausibleMin: this.env.PLAUSIBLE_MIN_PPK,
        plausibleMax: this.env.PLAUSIBLE_MAX_PPK,
        source: null,
      };
    }
    const modal = round2(current.modalPpk);
    return {
      date: current.date,
      modalPpk: modal,
      plausibleMin: round2(modal * PLAUSIBLE_FACTORS.min),
      plausibleMax: round2(modal * PLAUSIBLE_FACTORS.max),
      source: REFERENCE_SOURCE,
    };
  }
}
