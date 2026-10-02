import { Module } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';
import { CloudflareTurnstileVerifier, TurnstileVerifier } from './turnstile.verifier';

@Module({
  providers: [
    { provide: TurnstileVerifier, useClass: CloudflareTurnstileVerifier },
    TurnstileService,
  ],
  exports: [TurnstileService],
})
export class TurnstileModule {}
