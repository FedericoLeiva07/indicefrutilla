import { IndexLevel } from '@indice/shared';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('price_index_weekly')
export class PriceIndexWeeklyEntity {
  @PrimaryColumn({ type: 'date', name: 'week_start' })
  weekStart: string;

  @PrimaryColumn({ type: 'enum', enum: Object.values(IndexLevel), enumName: 'index_level' })
  level: IndexLevel;

  @PrimaryColumn({ type: 'varchar', length: 5, name: 'zone_id' })
  zoneId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'median_ppk', nullable: true })
  medianPpk: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'p25_ppk', nullable: true })
  p25Ppk: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'p75_ppk', nullable: true })
  p75Ppk: number | null;

  @Column({ type: 'integer', name: 'sample_size' })
  sampleSize: number;

  @Column({ type: 'integer', name: 'store_count' })
  storeCount: number;

  @Column({ type: 'boolean' })
  published: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'computed_at' })
  computedAt: Date;
}
