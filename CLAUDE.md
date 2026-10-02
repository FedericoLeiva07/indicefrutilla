# Índice Frutilla — reglas para Claude

## Fuente de verdad

- [docs/spec.md](docs/spec.md) manda. El plan de 6 semanas está en §10; se avanza en ese orden.
- Si el spec no alcanza o surge un imprevisto, Claude decide solo, elige la opción más razonable y la deja anotada en el resumen final y en el mensaje del commit.

## Alcance y límites

- Solo se trabaja sobre este repo: `apps/web`, `apps/api`, `packages/shared`, `docs`, y los servicios locales de `docker-compose.yml`.
- Fuentes externas permitidas: las que nombra el spec (Georef / datos.gob.ar, Mercado Central de Buenos Aires, Cloudflare Turnstile) y los registros de paquetes (npm, cdn.sheetjs.com).
- El navegador integrado se usa solo para la web y la API del proyecto (`localhost:5173`, `localhost:3000`) y la documentación técnica que haga falta.
- Prohibido: datos personales del usuario, mail, redes sociales, cuentas, el Chrome del usuario (Claude in Chrome), y cualquier archivo fuera del repo que no sea de configuración de Claude.

## Código

- Sin comentarios en el código.
- TypeScript estricto. Textos de UI, mensajes de error y tests en español rioplatense; identificadores en inglés.
- API (NestJS): cada módulo en `modules/<nombre>/{api,application,infra,domain}`.
  - `api`: controllers y DTOs con class-validator. Los códigos de error por campo salen del nombre del validador (`required`, `range`, `recentDate`…).
  - `application`: servicios con la lógica.
  - `infra`: entidades TypeORM y SQL crudo en `*.queries.ts`.
- Errores: siempre `AppException` con un `ErrorCode` de `@indice/shared` y el formato de §5.3.
- Tipos y reglas compartidas con la web en `packages/shared` (rebuild con `pnpm --filter @indice/shared build`).
- Fechas de negocio en hora de Argentina con los helpers de `packages/shared/src/dates.ts`.
- Migraciones escritas a mano. Después de agregar una, `pnpm --filter @indice/api migration:generate src/database/migrations/Check` tiene que decir que no hay cambios. Los índices que TypeORM no sabe expresar van con `synchronize: false`.
- La IP en claro nunca se guarda (ni en la base ni en Redis): se usa `IpHasher`.
- Una dependencia sin hash de integridad en el lockfile se vendoriza en `apps/api/vendor/`.

## Tests

- Unitarios en `test/unit`; e2e contra `indice_test` en `test/e2e`, con datos armados en `fixtures.ts`.
- Cada estado de §9 que toca el backend tiene su e2e.
- Antes de commitear:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
TEST_REDIS_URL=redis://localhost:6389 pnpm --filter @indice/api test:e2e
pnpm --filter @indice/web test:e2e
pnpm build
```

- La prueba de carga (`pnpm --filter @indice/api test:load`) se corre cuando se toca una consulta de lectura o un límite.

## Git

- Conventional commits en inglés. Sin `Co-Authored-By` ni menciones a Claude.
- Un commit por semana del plan o por cambio coherente, en `main`. No se hace push sin que el usuario lo pida.
