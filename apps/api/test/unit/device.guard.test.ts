import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../src/common/app-exception';
import { DeviceGuard, type DeviceRequest } from '../../src/modules/device/device.guard';

function contextWith(header: string | undefined): { ctx: ExecutionContext; req: DeviceRequest } {
  const req = {
    header: (name: string) => (name === 'x-device-id' ? header : undefined),
  } as DeviceRequest;
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('DeviceGuard', () => {
  const guard = new DeviceGuard();

  it('acepta un UUID v4 y lo deja en el request en minúsculas', () => {
    const { ctx, req } = contextWith('3F6C2A9E-1B2C-4D5E-8F90-1234567890AB');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.deviceId).toBe('3f6c2a9e-1b2c-4d5e-8f90-1234567890ab');
  });

  it.each([undefined, '', 'abc', '3f6c2a9e-1b2c-1d5e-8f90-1234567890ab'])(
    'rechaza %s con VALIDATION_FAILED',
    (header) => {
      const { ctx } = contextWith(header);
      try {
        guard.canActivate(ctx);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).toBody().error).toMatchObject({
          code: 'VALIDATION_FAILED',
          details: [{ field: 'X-Device-Id', code: 'isUuid' }],
        });
      }
    },
  );
});
