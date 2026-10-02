import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ReferenceLatestDto } from '@indice/shared';
import { ReferenceService } from '../application/reference.service';

@ApiTags('reference')
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('latest')
  @Header('Cache-Control', 'public, max-age=600')
  latest(): Promise<ReferenceLatestDto> {
    return this.reference.latest();
  }
}
