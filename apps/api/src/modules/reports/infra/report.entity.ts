import { Presentation, Quality, ReportStatus } from '@indice/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StoreEntity } from '../../stores/infra/store.entity';

@Entity('reports')
@Index('reports_store_observed_idx', { synchronize: false })
@Index('reports_status_observed_idx', ['status', 'observedAt'])
@Index('reports_device_created_idx', ['deviceId', 'createdAt'])
@Index('reports_ip_created_idx', ['ipHash', 'createdAt'])
export class ReportEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'bigint', name: 'store_id' })
  storeId: number;

  @ManyToOne(() => StoreEntity)
  @JoinColumn({ name: 'store_id', foreignKeyConstraintName: 'reports_store_id_fkey' })
  store?: StoreEntity;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'price_ars' })
  priceArs: number;

  @Column({ type: 'enum', enum: Object.values(Presentation), enumName: 'report_presentation' })
  presentation: Presentation;

  @Column({ type: 'integer', name: 'quantity_g' })
  quantityG: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'price_per_kg' })
  pricePerKg: number;

  @Column({ type: 'enum', enum: Object.values(Quality), enumName: 'report_quality' })
  quality: Quality;

  @Column({ type: 'date', name: 'observed_at' })
  observedAt: string;

  @Column({ type: 'varchar', length: 30, name: 'reporter_name', nullable: true })
  reporterName: string | null;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'bytea', name: 'ip_hash' })
  ipHash: Buffer;

  @Column({
    type: 'enum',
    enum: Object.values(ReportStatus),
    enumName: 'report_status',
    default: ReportStatus.Active,
  })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
