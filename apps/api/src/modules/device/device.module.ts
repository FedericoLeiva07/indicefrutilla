import { Module } from '@nestjs/common';
import { DeviceGuard } from './device.guard';
import { IpHasher } from './ip-hasher.service';

@Module({
  providers: [DeviceGuard, IpHasher],
  exports: [DeviceGuard, IpHasher],
})
export class DeviceModule {}
