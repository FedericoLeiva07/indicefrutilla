import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UUID_V4 } from './device.guard';

export const OptionalDeviceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const header = ctx.switchToHttp().getRequest<Request>().header('x-device-id');
    return header && UUID_V4.test(header) ? header.toLowerCase() : null;
  },
);
