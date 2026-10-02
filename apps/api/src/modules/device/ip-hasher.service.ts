import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { type Env, InjectEnv } from '../../config/config.module';
import { clientIp, hashIp } from './client-ip';

@Injectable()
export class IpHasher {
  constructor(@InjectEnv() private readonly env: Env) {}

  hashRequest(req: Request): Buffer {
    return hashIp(clientIp(req, this.env.TRUST_CLOUDFLARE), this.env.IP_HASH_SECRET);
  }
}
