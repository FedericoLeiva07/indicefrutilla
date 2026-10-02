import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { ReferenceImportModule } from '../modules/reference/import/reference-import.module';
import { WorkerJobs } from './worker.jobs';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), ReferenceImportModule, IdempotencyModule],
  providers: [WorkerJobs],
})
export class WorkerModule {}
