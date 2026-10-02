import { Module } from '@nestjs/common';
import { ReferenceController } from './api/reference.controller';
import { ReferenceService } from './application/reference.service';
import { ReferenceQueries } from './infra/reference.queries';

@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService, ReferenceQueries],
  exports: [ReferenceService, ReferenceQueries],
})
export class ReferenceModule {}
