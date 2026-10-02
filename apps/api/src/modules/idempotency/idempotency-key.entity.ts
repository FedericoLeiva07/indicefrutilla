import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKeyEntity {
  @PrimaryColumn({ type: 'uuid' })
  key: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'bytea', name: 'request_hash' })
  requestHash: Buffer;

  @Column({ type: 'integer', name: 'status_code' })
  statusCode: number;

  @Column({ type: 'jsonb' })
  response: unknown;

  @Index('idempotency_keys_created_idx')
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
