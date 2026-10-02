export const VOTE_BALANCE = (alias: string) =>
  `(count(DISTINCT ${alias}.ip_hash) FILTER (WHERE ${alias}.value = 1)
    - count(DISTINCT ${alias}.ip_hash) FILTER (WHERE ${alias}.value = -1))`;

export const VOTES_LATERAL = (deviceParam: string) => `
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE v.value = 1)::int AS up,
           count(*) FILTER (WHERE v.value = -1)::int AS down,
           ${VOTE_BALANCE('v')}::int AS balance,
           max(v.value) FILTER (WHERE v.device_id = ${deviceParam}::uuid)::int AS my_vote
      FROM report_votes v
     WHERE v.report_id = r.id
  ) vt ON true`;
