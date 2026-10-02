import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Point } from 'typeorm';
import { DepartmentEntity } from '../../geo/infra/department.entity';
import { ProvinceEntity } from '../../geo/infra/province.entity';

@Entity('stores')
@Index('stores_device_created_idx', ['createdByDevice', 'createdAt'])
@Index('stores_ip_created_idx', ['createdIpHash', 'createdAt'])
export class StoreEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Index('stores_name_trgm_idx', { synchronize: false })
  @Column({ type: 'varchar', length: 80, name: 'name_normalized' })
  nameNormalized: string;

  @Column({ type: 'varchar', length: 120 })
  address: string;

  @Index('stores_location_idx', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  @Column({ type: 'varchar', length: 2, name: 'province_id' })
  provinceId: string;

  @ManyToOne(() => ProvinceEntity)
  @JoinColumn({ name: 'province_id', foreignKeyConstraintName: 'stores_province_id_fkey' })
  province?: ProvinceEntity;

  @Column({ type: 'varchar', length: 5, name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => DepartmentEntity)
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'stores_department_id_fkey' })
  department?: DepartmentEntity;

  @Column({ type: 'uuid', name: 'created_by_device' })
  createdByDevice: string;

  @Column({ type: 'bytea', name: 'created_ip_hash' })
  createdIpHash: Buffer;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
