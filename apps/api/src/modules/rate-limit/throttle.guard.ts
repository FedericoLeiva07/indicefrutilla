import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { ErrorCode } from '@indice/shared';
import { AppException } from '../../common/app-exception';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new AppException(
      ErrorCode.RateLimited,
      429,
      'Demasiados intentos seguidos. Esperá un momento',
      undefined,
      Math.max(1, detail.timeToBlockExpire),
    );
  }
}
