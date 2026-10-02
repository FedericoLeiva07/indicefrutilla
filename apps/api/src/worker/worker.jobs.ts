import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ARGENTINA_TZ } from '@indice/shared';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { ReferenceImportService } from '../modules/reference/import/reference-import.service';

@Injectable()
export class WorkerJobs {
  private readonly logger = new Logger(WorkerJobs.name);

  constructor(
    private readonly referenceImport: ReferenceImportService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Cron('0 14,18 * * 1-5', { name: 'reference-prices', timeZone: ARGENTINA_TZ })
  async importReferencePrices(): Promise<void> {
    try {
      await this.referenceImport.run('recent');
    } catch (err) {
      this.logger.error(`Falló la importación del Mercado Central: ${String(err)}`);
    }
  }

  @Cron('30 4 * * *', { name: 'idempotency-cleanup', timeZone: ARGENTINA_TZ })
  async purgeIdempotencyKeys(): Promise<void> {
    const count = await this.idempotency.purgeExpired();
    this.logger.log(`Claves de idempotencia vencidas borradas: ${count}`);
  }
}
