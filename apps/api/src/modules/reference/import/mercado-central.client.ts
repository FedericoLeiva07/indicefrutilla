import { Injectable } from '@nestjs/common';
import { type Env, InjectEnv } from '../../../config/config.module';

const TIMEOUT_MS = 60_000;
const HEADERS = { 'User-Agent': 'IndiceFrutilla/1.0' };

@Injectable()
export class MercadoCentralClient {
  readonly pageUrl: string;

  constructor(@InjectEnv() env: Pick<Env, 'MERCADO_CENTRAL_URL'>) {
    this.pageUrl = env.MERCADO_CENTRAL_URL;
  }

  async fetchPage(): Promise<string> {
    const res = await this.get(this.pageUrl);
    return res.text();
  }

  async fetchZip(url: string): Promise<Uint8Array> {
    const res = await this.get(url);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async get(url: string): Promise<Response> {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Mercado Central respondió ${res.status} para ${url}`);
    return res;
  }
}
