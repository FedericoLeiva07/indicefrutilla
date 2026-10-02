import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module';
import { PriceIndexModule } from '../price-index/price-index.module';
import { CommunityController } from './api/community.controller';
import { CommunityService } from './application/community.service';
import { CommunityQueries } from './infra/community.queries';

@Module({
  imports: [DeviceModule, PriceIndexModule],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityQueries],
})
export class CommunityModule {}
