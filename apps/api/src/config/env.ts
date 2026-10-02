import { z } from 'zod';

const TURNSTILE_TEST_SECRETS = /^[123]x0{30,}A{2}$/;

export const MERCADO_CENTRAL_DEFAULT_URL =
  'https://mercadocentral.gob.ar/informaci%C3%B3n/precios-mayoristas';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    IP_HASH_SECRET: z.string().min(32),
    TRUST_CLOUDFLARE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    PROXY_SECRET: z.string().min(32).optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
    REDIS_URL: z.string().url().optional(),
    THROTTLE_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    PLAUSIBLE_MIN_PPK: z.coerce.number().positive().default(2000),
    PLAUSIBLE_MAX_PPK: z.coerce.number().positive().default(100000),
    MERCADO_CENTRAL_URL: z.string().url().default(MERCADO_CENTRAL_DEFAULT_URL),
  })
  .refine((env) => env.PLAUSIBLE_MIN_PPK < env.PLAUSIBLE_MAX_PPK, {
    path: ['PLAUSIBLE_MIN_PPK'],
    message: 'debe ser menor que PLAUSIBLE_MAX_PPK',
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.REDIS_URL, {
    path: ['REDIS_URL'],
    message: 'es obligatoria en producción',
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.PROXY_SECRET, {
    path: ['PROXY_SECRET'],
    message: 'es obligatoria en producción',
  })
  .refine((env) => !(env.PROXY_SECRET && env.TRUST_CLOUDFLARE), {
    path: ['TRUST_CLOUDFLARE'],
    message: 'no se puede combinar con PROXY_SECRET',
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || !TURNSTILE_TEST_SECRETS.test(env.TURNSTILE_SECRET_KEY),
    { path: ['TURNSTILE_SECRET_KEY'], message: 'no puede ser una clave de prueba en producción' },
  );

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
