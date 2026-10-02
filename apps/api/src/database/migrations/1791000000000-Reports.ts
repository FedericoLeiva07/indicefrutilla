import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Reports1791000000000 implements MigrationInterface {
  name = 'Reports1791000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE report_presentation AS ENUM ('g250', 'g500', 'kg1', 'cajon', 'otro')`,
    );
    await q.query(`CREATE TYPE report_quality AS ENUM ('primera', 'segunda')`);
    await q.query(`CREATE TYPE report_status AS ENUM ('active', 'flagged')`);
    await q.query(`CREATE TYPE index_level AS ENUM ('department', 'province', 'country')`);

    await q.query(`
      CREATE TABLE stores (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name varchar(80) NOT NULL,
        name_normalized varchar(80) NOT NULL,
        address varchar(120) NOT NULL,
        location geography(Point, 4326) NOT NULL,
        province_id varchar(2) NOT NULL REFERENCES provinces(id),
        department_id varchar(5) NOT NULL REFERENCES departments(id),
        created_by_device uuid NOT NULL,
        created_ip_hash bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX stores_location_idx ON stores USING GIST (location)`);
    await q.query(
      `CREATE INDEX stores_name_trgm_idx ON stores USING GIN (name_normalized gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX stores_device_created_idx ON stores (created_by_device, created_at)`,
    );
    await q.query(`CREATE INDEX stores_ip_created_idx ON stores (created_ip_hash, created_at)`);

    await q.query(`
      CREATE TABLE reports (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        store_id bigint NOT NULL REFERENCES stores(id),
        price_ars numeric(12, 2) NOT NULL,
        presentation report_presentation NOT NULL,
        quantity_g integer NOT NULL,
        price_per_kg numeric(12, 2) NOT NULL,
        quality report_quality NOT NULL,
        observed_at date NOT NULL,
        reporter_name varchar(30),
        device_id uuid NOT NULL,
        ip_hash bytea NOT NULL,
        status report_status NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX reports_store_observed_idx ON reports (store_id, observed_at DESC)`,
    );
    await q.query(`CREATE INDEX reports_status_observed_idx ON reports (status, observed_at)`);
    await q.query(`CREATE INDEX reports_device_created_idx ON reports (device_id, created_at)`);
    await q.query(`CREATE INDEX reports_ip_created_idx ON reports (ip_hash, created_at)`);

    await q.query(`
      CREATE TABLE price_index_weekly (
        week_start date NOT NULL,
        level index_level NOT NULL,
        zone_id varchar(5) NOT NULL,
        median_ppk numeric(12, 2),
        p25_ppk numeric(12, 2),
        p75_ppk numeric(12, 2),
        sample_size integer NOT NULL,
        store_count integer NOT NULL,
        published boolean NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (week_start, level, zone_id)
      )`);

    await q.query(`
      CREATE TABLE reference_prices (
        date date NOT NULL,
        origin varchar(50) NOT NULL,
        package varchar(10) NOT NULL,
        kg numeric(6, 2) NOT NULL,
        quality varchar(10) NOT NULL,
        size varchar(30) NOT NULL,
        min_ppk numeric(12, 2) NOT NULL,
        modal_ppk numeric(12, 2) NOT NULL,
        max_ppk numeric(12, 2) NOT NULL,
        source_file varchar(100) NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (date, origin, package, kg, quality, size)
      )`);

    await q.query(`
      CREATE TABLE idempotency_keys (
        key uuid PRIMARY KEY,
        device_id uuid NOT NULL,
        request_hash bytea NOT NULL,
        status_code integer NOT NULL,
        response jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE idempotency_keys`);
    await q.query(`DROP TABLE reference_prices`);
    await q.query(`DROP TABLE price_index_weekly`);
    await q.query(`DROP TABLE reports`);
    await q.query(`DROP TABLE stores`);
    await q.query(`DROP TYPE index_level`);
    await q.query(`DROP TYPE report_status`);
    await q.query(`DROP TYPE report_quality`);
    await q.query(`DROP TYPE report_presentation`);
  }
}
