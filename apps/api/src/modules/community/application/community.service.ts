import { Injectable, Logger } from '@nestjs/common';
import {
  COMMUNITY_THRESHOLDS,
  ErrorCode,
  type FlagReason,
  type FlagResponse,
  type VoteResponse,
  type VoteValue,
  weekStart,
} from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';
import { AppException } from '../../../common/app-exception';
import { PriceIndexQueries } from '../../price-index/infra/price-index.queries';
import { assertActive } from '../../reports/application/reports-read.service';
import { CommunityQueries } from '../infra/community.queries';

export interface Voter {
  deviceId: string;
  ipHash: Buffer;
}

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly queries: CommunityQueries,
    private readonly priceIndex: PriceIndexQueries,
  ) {}

  async vote(reportId: number, value: VoteValue, voter: Voter): Promise<VoteResponse> {
    return this.dataSource.transaction(async (em) => {
      await this.lockActive(em, reportId);
      const inserted = await this.queries.insertVote(em, { reportId, value, ...voter });
      const votes = await this.queries.votes(em, reportId);
      const summary = { up: votes.up, down: votes.down };
      if (!inserted) {
        const myVote = await this.queries.myVote(em, reportId, voter.deviceId);
        throw new AppException(
          ErrorCode.AlreadyVoted,
          409,
          'Ya votaste esta oferta desde este dispositivo',
          { votes: summary, myVote },
        );
      }
      return {
        votes: summary,
        myVote: value,
        active: votes.balance > COMMUNITY_THRESHOLDS.minVoteBalance,
      };
    });
  }

  async flag(reportId: number, reason: FlagReason, voter: Voter): Promise<FlagResponse> {
    const result = await this.dataSource.transaction(async (em) => {
      const report = await this.lockActive(em, reportId);
      const inserted = await this.queries.insertFlag(em, { reportId, reason, ...voter });
      if (!inserted) {
        throw new AppException(ErrorCode.AlreadyFlagged, 409, 'Ya denunciaste esta oferta');
      }
      const flaggers = await this.queries.distinctFlaggers(em, reportId);
      const hidden = flaggers >= COMMUNITY_THRESHOLDS.flagsToHide;
      if (hidden) await this.queries.markFlagged(em, reportId);
      return { hidden, observedAt: report.observedAt };
    });
    if (result.hidden) {
      await this.priceIndex.recompute(weekStart(result.observedAt)).catch((err: unknown) => {
        this.logger.error(`No se pudo recalcular el índice: ${String(err)}`);
      });
    }
    return { hidden: result.hidden };
  }

  private async lockActive(em: EntityManager, reportId: number): Promise<{ observedAt: string }> {
    const report = await this.queries.lockReport(em, reportId);
    if (!report) throw new AppException(ErrorCode.NotFound, 404, 'No existe esa oferta');
    const { balance } = await this.queries.votes(em, reportId);
    assertActive({ status: report.status, observedAt: report.observedAt, voteBalance: balance });
    return report;
  }
}
