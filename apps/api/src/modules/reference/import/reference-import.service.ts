import { Injectable, Logger } from '@nestjs/common';
import { argentinaDate } from '@indice/shared';
import { DataSource } from 'typeorm';
import { extractZipLinks, selectRecentZips } from './mercado-central.links';
import { MercadoCentralClient } from './mercado-central.client';
import {
  extractDailyFiles,
  parseDailyFile,
  type ReferencePriceRow,
  referenceRowKey,
} from './mercado-central.parser';

export type ImportMode = 'recent' | 'all';

export interface ImportSummary {
  zips: string[];
  files: number;
  rows: number;
  errors: string[];
}

@Injectable()
export class ReferenceImportService {
  private readonly logger = new Logger(ReferenceImportService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly client: MercadoCentralClient,
  ) {}

  async run(mode: ImportMode = 'recent', now: Date = new Date()): Promise<ImportSummary> {
    const links = extractZipLinks(await this.client.fetchPage(), this.client.pageUrl);
    for (const l of links.filter((l) => l.month === null)) {
      this.logger.warn(`No se pudo leer el mes de ${l.fileName}`);
    }
    const selected = mode === 'all' ? links : selectRecentZips(links, argentinaDate(now));
    const summary: ImportSummary = { zips: [], files: 0, rows: 0, errors: [] };
    const rows = new Map<string, ReferencePriceRow>();

    for (const link of selected) {
      try {
        const files = extractDailyFiles(await this.client.fetchZip(link.url));
        for (const file of files) {
          try {
            for (const row of parseDailyFile(file)) rows.set(referenceRowKey(row), row);
            summary.files += 1;
          } catch (err) {
            summary.errors.push(`${link.fileName}/${file.name}: ${errorMessage(err)}`);
          }
        }
        summary.zips.push(link.fileName);
      } catch (err) {
        summary.errors.push(`${link.fileName}: ${errorMessage(err)}`);
      }
    }

    summary.rows = await this.upsert([...rows.values()]);
    this.logger.log(
      `Mercado Central: ${summary.rows} filas de ${summary.files} archivos (${summary.zips.join(', ') || 'sin ZIPs'})`,
    );
    for (const e of summary.errors) this.logger.error(e);
    return summary;
  }

  async upsert(rows: ReferencePriceRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const column = <K extends keyof ReferencePriceRow>(k: K) => rows.map((r) => r[k]);
    await this.dataSource.query(
      `INSERT INTO reference_prices
         (date, origin, package, kg, quality, size, min_ppk, modal_ppk, max_ppk, source_file)
       SELECT * FROM unnest($1::date[], $2::text[], $3::text[], $4::numeric[], $5::text[],
                            $6::text[], $7::numeric[], $8::numeric[], $9::numeric[], $10::text[])
       ON CONFLICT (date, origin, package, kg, quality, size) DO UPDATE
         SET min_ppk = EXCLUDED.min_ppk,
             modal_ppk = EXCLUDED.modal_ppk,
             max_ppk = EXCLUDED.max_ppk,
             source_file = EXCLUDED.source_file,
             imported_at = now()`,
      [
        column('date'),
        column('origin'),
        column('package'),
        column('kg'),
        column('quality'),
        column('size'),
        column('minPpk'),
        column('modalPpk'),
        column('maxPpk'),
        column('sourceFile'),
      ],
    );
    return rows.length;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
