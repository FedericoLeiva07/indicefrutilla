import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode } from '@indice/shared';
import type { Request } from 'express';
import { AppException } from '../../common/app-exception';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DeviceRequest extends Request {
  deviceId: string;
}

@Injectable()
export class DeviceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<DeviceRequest>();
    const header = req.header('x-device-id');
    if (!header || !UUID_V4.test(header)) {
      throw new AppException(ErrorCode.ValidationFailed, 400, 'Falta un X-Device-Id válido', [
        { field: 'X-Device-Id', code: 'isUuid' },
      ]);
    }
    req.deviceId = header.toLowerCase();
    return true;
  }
}
