import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@indice/shared';
import type { Request } from 'express';
import { AppException } from '../../common/app-exception';
import { type Env, InjectEnv } from '../../config/config.module';
import { clientIp, clientIpHeader } from '../device/client-ip';
import { TurnstileVerifier } from './turnstile.verifier';

@Injectable()
export class TurnstileService {
  constructor(
    private readonly verifier: TurnstileVerifier,
    @InjectEnv() private readonly env: Env,
  ) {}

  async assertHuman(token: string, req: Request): Promise<void> {
    const ok = await this.verifier.verify(token, clientIp(req, clientIpHeader(this.env)));
    if (!ok) {
      throw new AppException(
        ErrorCode.TurnstileFailed,
        403,
        'No pudimos verificar que seas una persona',
      );
    }
  }
}
