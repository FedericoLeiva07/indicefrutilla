import { FlagReason } from '@indice/shared';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ReportEntity } from '../../reports/infra/report.entity';

@Entity('report_flags')
export class ReportFlagEntity {
  @PrimaryColumn({ type: 'bigint', name: 'report_id' })
  reportId: number;

  @ManyToOne(() => ReportEntity)
  @JoinColumn({ name: 'report_id', foreignKeyConstraintName: 'report_flags_report_id_fkey' })
  report?: ReportEntity;

  @PrimaryColumn({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'bytea', name: 'ip_hash' })
  ipHash: Buffer;

  @Column({ type: 'enum', enum: Object.values(FlagReason), enumName: 'flag_reason' })
  reason: FlagReason;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
