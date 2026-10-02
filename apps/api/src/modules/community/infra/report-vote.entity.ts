import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ReportEntity } from '../../reports/infra/report.entity';

@Entity('report_votes')
@Check('report_votes_value_check', 'value IN (-1, 1)')
@Index('report_votes_device_created_idx', ['deviceId', 'createdAt'])
export class ReportVoteEntity {
  @PrimaryColumn({ type: 'bigint', name: 'report_id' })
  reportId: number;

  @ManyToOne(() => ReportEntity)
  @JoinColumn({ name: 'report_id', foreignKeyConstraintName: 'report_votes_report_id_fkey' })
  report?: ReportEntity;

  @PrimaryColumn({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'bytea', name: 'ip_hash' })
  ipHash: Buffer;

  @Column({ type: 'smallint' })
  value: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
