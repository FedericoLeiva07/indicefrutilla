# Prueba de carga

`pnpm --filter @indice/api test:load` levanta la API real en un puerto local contra `indice_test`, siembra 200 comercios y 2.000 ofertas alrededor de Caseros y corre cinco escenarios. Con `TEST_REDIS_URL` usa Redis para los límites, como en producción.

```bash
TEST_REDIS_URL=redis://localhost:6389 pnpm --filter @indice/api test:load
```

## Resultados (2026-10-02, máquina de desarrollo, Postgres y Redis en Docker)

| Escenario                                                                                | Resultado                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 3.000 lecturas mezcladas (`/reports`, `/index/summary`, `/stores/nearby`), 50 conexiones | 529 req/s · p50 78 ms · p95 148 ms · p99 351 ms · 0 errores |
| 20 requests simultáneos desde una IP                                                     | 5 pasan, 15 `RATE_LIMITED` con `Retry-After: 1`             |
| 12 escrituras simultáneas de un dispositivo desde IPs distintas                          | 5 pasan, 7 `RATE_LIMITED`                                   |
| 15 escrituras de una IP con dispositivos distintos, en 3 tandas                          | 10 pasan, 5 `RATE_LIMITED`                                  |
| 30 `POST /reports` simultáneos de un dispositivo (sin límite por minuto)                 | 20 creadas, 10 `DAILY_LIMIT_REACHED`                        |

## Hallazgos

- La primera medición dio p95 de 878 ms. El listado de ofertas recorría el índice espacial de comercios una vez por oferta y calculaba el saldo de votos de todas las candidatas. Se reescribió: primero los comercios cercanos (una consulta espacial), después sus ofertas por `store_id`, y la página y el total en una sola pasada. Los votos se calculan solo para las 20 filas de la página.
- Con datos cargados en bloque y sin `ANALYZE`, Postgres elige un plan malo para esa consulta. En producción lo cubre el autovacuum; después de una importación grande conviene correr `ANALYZE`.
- El límite diario es exacto con envíos concurrentes gracias al lock por dispositivo dentro de la transacción.
