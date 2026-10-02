import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Point } from 'typeorm';

@Entity('provinces')
export class ProvinceEntity {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  centroid: Point;
}
