import { COMMUNITY_THRESHOLDS } from '@indice/shared';

export const VOTES_LATERAL = (deviceParam: string) => `
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE v.value = 1)::int AS up,
           count(*) FILTER (WHERE v.value = -1)::int AS down,
           (count(DISTINCT v.ip_hash) FILTER (WHERE v.value = 1)
            - count(DISTINCT v.ip_hash) FILTER (WHERE v.value = -1))::int AS balance,
           max(v.value) FILTER (WHERE v.device_id = ${deviceParam}::uuid)::int AS my_vote
      FROM report_votes v
     WHERE v.report_id = r.id
  ) vt ON true`;

export const ABOVE_VOTE_THRESHOLD = `vt.balance > ${COMMUNITY_THRESHOLDS.minVoteBalance}`;
