import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Community1791100000000 implements MigrationInterface {
  name = 'Community1791100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE flag_reason AS ENUM ('precio_falso', 'duplicada', 'spam')`);

    await q.query(`
      CREATE TABLE report_votes (
        report_id bigint NOT NULL REFERENCES reports(id),
        device_id uuid NOT NULL,
        ip_hash bytea NOT NULL,
        value smallint NOT NULL CHECK (value IN (-1, 1)),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (report_id, device_id)
      )`);
    await q.query(
      `CREATE INDEX report_votes_device_created_idx ON report_votes (device_id, created_at)`,
    );

    await q.query(`
      CREATE TABLE report_flags (
        report_id bigint NOT NULL REFERENCES reports(id),
        device_id uuid NOT NULL,
        ip_hash bytea NOT NULL,
        reason flag_reason NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (report_id, device_id)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE report_flags`);
    await q.query(`DROP TABLE report_votes`);
    await q.query(`DROP TYPE flag_reason`);
  }
}
