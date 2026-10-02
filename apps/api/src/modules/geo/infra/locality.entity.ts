import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Point } from 'typeorm';
import { DepartmentEntity } from './department.entity';
import { ProvinceEntity } from './province.entity';

@Entity('localities')
export class LocalityEntity {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'varchar', length: 2, name: 'province_id' })
  provinceId: string;

  @ManyToOne(() => ProvinceEntity)
  @JoinColumn({ name: 'province_id', foreignKeyConstraintName: 'localities_province_id_fkey' })
  province?: ProvinceEntity;

  @Index('localities_department_idx')
  @Column({ type: 'varchar', length: 5, name: 'department_id', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => DepartmentEntity)
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'localities_department_id_fkey' })
  department?: DepartmentEntity | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  centroid: Point;
}
