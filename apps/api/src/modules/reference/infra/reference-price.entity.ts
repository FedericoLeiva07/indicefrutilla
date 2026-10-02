import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('reference_prices')
export class ReferencePriceEntity {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  origin: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  package: string;

  @PrimaryColumn({ type: 'numeric', precision: 6, scale: 2 })
  kg: number;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  quality: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  size: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'min_ppk' })
  minPpk: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'modal_ppk' })
  modalPpk: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'max_ppk' })
  maxPpk: number;

  @Column({ type: 'varchar', length: 100, name: 'source_file' })
  sourceFile: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'imported_at' })
  importedAt: Date;
}
