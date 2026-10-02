import { Injectable } from '@nestjs/common';
import { type Env, InjectEnv } from '../../config/config.module';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

export abstract class TurnstileVerifier {
  abstract verify(token: string, remoteIp: string): Promise<boolean>;
}

@Injectable()
export class CloudflareTurnstileVerifier extends TurnstileVerifier {
  constructor(@InjectEnv() private readonly env: Env) {
    super();
  }

  async verify(token: string, remoteIp: string): Promise<boolean> {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret: this.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Turnstile respondió ${res.status}`);
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  }
}
