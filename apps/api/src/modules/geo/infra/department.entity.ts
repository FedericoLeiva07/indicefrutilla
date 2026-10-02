import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { MultiPolygon, Point } from 'typeorm';
import { ProvinceEntity } from './province.entity';

@Entity('departments')
export class DepartmentEntity {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  id: string;

  @Index('departments_province_idx')
  @Column({ type: 'varchar', length: 2, name: 'province_id' })
  provinceId: string;

  @ManyToOne(() => ProvinceEntity)
  @JoinColumn({ name: 'province_id', foreignKeyConstraintName: 'departments_province_id_fkey' })
  province?: ProvinceEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  centroid: Point;

  @Index('departments_geom_idx', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'MultiPolygon', srid: 4326 })
  geom: MultiPolygon;
}
