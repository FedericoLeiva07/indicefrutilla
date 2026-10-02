import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { DeviceRequest } from './device.guard';

export const DeviceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<DeviceRequest>().deviceId,
);
