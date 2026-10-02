import { Module } from '@nestjs/common';
import { MercadoCentralClient } from './mercado-central.client';
import { ReferenceImportService } from './reference-import.service';

@Module({
  providers: [MercadoCentralClient, ReferenceImportService],
  exports: [ReferenceImportService],
})
export class ReferenceImportModule {}
