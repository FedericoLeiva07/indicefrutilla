import { Injectable } from '@nestjs/common';
import type { FlagReason, VoteValue } from '@indice/shared';
import type { EntityManager } from 'typeorm';

export interface VoteSummary {
  up: number;
  down: number;
  balance: number;
}

@Injectable()
export class CommunityQueries {
  async lockReport(
    em: EntityManager,
    reportId: number,
  ): Promise<{ status: string; observedAt: string } | null> {
    const rows: Array<{ status: string; observedAt: string }> = await em.query(
      `SELECT status, to_char(observed_at, 'YYYY-MM-DD') AS "observedAt"
         FROM reports WHERE id = $1 FOR UPDATE`,
      [reportId],
    );
    return rows[0] ?? null;
  }

  async votes(em: EntityManager, reportId: number): Promise<VoteSummary> {
    const [row]: VoteSummary[] = await em.query(
      `SELECT count(*) FILTER (WHERE value = 1)::int AS up,
              count(*) FILTER (WHERE value = -1)::int AS down,
              (count(DISTINCT ip_hash) FILTER (WHERE value = 1)
               - count(DISTINCT ip_hash) FILTER (WHERE value = -1))::int AS balance
         FROM report_votes WHERE report_id = $1`,
      [reportId],
    );
    return row ?? { up: 0, down: 0, balance: 0 };
  }

  async myVote(em: EntityManager, reportId: number, deviceId: string): Promise<VoteValue | null> {
    const rows: Array<{ value: VoteValue }> = await em.query(
      `SELECT value FROM report_votes WHERE report_id = $1 AND device_id = $2`,
      [reportId, deviceId],
    );
    return rows[0]?.value ?? null;
  }

  async insertVote(
    em: EntityManager,
    vote: { reportId: number; deviceId: string; ipHash: Buffer; value: VoteValue },
  ): Promise<boolean> {
    const rows: unknown[] = await em.query(
      `INSERT INTO report_votes (report_id, device_id, ip_hash, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id, device_id) DO NOTHING
       RETURNING 1`,
      [vote.reportId, vote.deviceId, vote.ipHash, vote.value],
    );
    return rows.length > 0;
  }

  async insertFlag(
    em: EntityManager,
    flag: { reportId: number; deviceId: string; ipHash: Buffer; reason: FlagReason },
  ): Promise<boolean> {
    const rows: unknown[] = await em.query(
      `INSERT INTO report_flags (report_id, device_id, ip_hash, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id, device_id) DO NOTHING
       RETURNING 1`,
      [flag.reportId, flag.deviceId, flag.ipHash, flag.reason],
    );
    return rows.length > 0;
  }

  async distinctFlaggers(em: EntityManager, reportId: number): Promise<number> {
    const [row]: Array<{ n: number }> = await em.query(
      `SELECT count(DISTINCT ip_hash)::int AS n FROM report_flags WHERE report_id = $1`,
      [reportId],
    );
    return row?.n ?? 0;
  }

  async markFlagged(em: EntityManager, reportId: number): Promise<void> {
    await em.query(`UPDATE reports SET status = 'flagged' WHERE id = $1`, [reportId]);
  }
}
