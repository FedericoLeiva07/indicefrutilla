# Índice Frutilla

Precios de frutilla cargados por la comunidad, en lista y mapa, con un índice semanal en $/kg por zona.

- Spec del MVP: [docs/spec.md](docs/spec.md)
- Monorepo pnpm: `apps/api` (NestJS + TypeORM + PostGIS), `apps/web` (Vite + React + Tailwind), `packages/shared` (tipos y reglas de dominio compartidas)

## Desarrollo local

Requisitos: Node 22.13+, Docker. pnpm se usa a través de corepack (`corepack enable` una vez, o anteponer `corepack` a cada comando).

```bash
pnpm install
pnpm db:up                                  # PostGIS en localhost:5442 (bases indice e indice_test)
cp .env.example apps/api/.env               # y generar IP_HASH_SECRET con: openssl rand -hex 32
pnpm --filter @indice/shared build
pnpm --filter @indice/api migration:run
pnpm --filter @indice/api seed:geo          # provincias, departamentos y localidades de Georef
pnpm dev                                    # API en :3000 (Swagger en /docs) y web en :5173
```

## Checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test                                   # unitarios
pnpm --filter @indice/api test:e2e          # e2e contra indice_test (se recrea en cada corrida)
```
