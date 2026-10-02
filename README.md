# Índice Frutilla

Precios de frutilla cargados por la comunidad, en lista y mapa, con un índice semanal en $/kg por zona.

- Spec del MVP: [docs/spec.md](docs/spec.md)
- Monorepo pnpm: `apps/api` (NestJS + TypeORM + PostGIS), `apps/web` (Vite + React + Tailwind), `packages/shared` (tipos y reglas de dominio compartidas)

## Desarrollo local

Requisitos: Node 22.13+, Docker. pnpm se usa a través de corepack (`corepack enable` una vez, o anteponer `corepack` a cada comando).

```bash
pnpm install
pnpm db:up                                  # PostGIS en :5442 (indice e indice_test) y Redis en :6389
cp .env.example apps/api/.env               # y generar IP_HASH_SECRET con: openssl rand -hex 32
cp apps/web/.env.example apps/web/.env       # clave de Turnstile (la de prueba de Cloudflare acepta todo)
pnpm --filter @indice/shared build
pnpm --filter @indice/api migration:run
pnpm --filter @indice/api seed:geo          # provincias, departamentos y localidades de Georef
pnpm --filter @indice/api import:reference --all   # precios mayoristas del Mercado Central (sin --all: mes actual y anterior)
pnpm --filter @indice/api seed:demo         # opcional: comercios y ofertas de prueba en Caseros (--reset los borra)
pnpm dev                                    # API en :3000 (Swagger en /docs) y web en :5173
pnpm --filter @indice/api dev:worker        # Mercado Central (14 y 18 h), índice semanal (cada hora) y limpieza de idempotencia
```

## Checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test                                   # unitarios
pnpm --filter @indice/api test:e2e          # e2e contra indice_test (se recrea en cada corrida)
TEST_REDIS_URL=redis://localhost:6389 pnpm --filter @indice/api test:e2e   # incluye el storage de Redis del rate limit
pnpm --filter @indice/web test:e2e          # Playwright: cada estado de §9 sobre el build de producción, con la API mockeada
TEST_REDIS_URL=redis://localhost:6389 pnpm --filter @indice/api test:load  # prueba de carga y límites (docs/prueba-de-carga.md)
```

Playwright necesita Chromium una vez: `pnpm --filter @indice/web exec playwright install chromium`.

## Deploy

Ver [docs/deploy.md](docs/deploy.md): Railway (Postgres con PostGIS, Redis, API y worker), Vercel como proxy de la API y variables de entorno.
