# Deploy

Arquitectura del spec (§10, semana 6): API detrás de Cloudflare, web en Vercel, Postgres gestionado con PostGIS. Este repo deja todo listo para desplegar; **crear las cuentas y hacer el primer deploy lo hace una persona**.

## Qué hace falta

| Pieza                | Para qué                                 | Requisito                                                                  |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Postgres gestionado  | Datos                                    | PostgreSQL 16 con las extensiones `postgis` y `pg_trgm`                    |
| Redis gestionado     | Límites por segundo y por minuto (§6)    | Cualquier Redis 6+ accesible desde la API                                  |
| Host de contenedores | API y worker                             | Corre la imagen de `apps/api/Dockerfile`; dos procesos con la misma imagen |
| Cloudflare           | DNS, proxy delante de la API y Turnstile | Zona del dominio y un widget de Turnstile (modo _managed_)                 |
| Vercel               | Web                                      | Proyecto apuntando a la raíz del repo (usa `vercel.json`)                  |

## 1. Base de datos

1. Crear la base y habilitar las extensiones (las migraciones las crean si el usuario tiene permiso).
2. Correr las migraciones con la imagen:

```bash
docker run --rm -e DATABASE_URL=… -e IP_HASH_SECRET=… -e TURNSTILE_SECRET_KEY=… -e REDIS_URL=… indice-api node dist/migrate.js
```

3. Cargar las zonas de Georef y el histórico del Mercado Central desde una máquina con el repo (usan `tsx`, que no está en la imagen):

```bash
DATABASE_URL=… pnpm --filter @indice/api seed:geo
DATABASE_URL=… pnpm --filter @indice/api import:reference --all
```

## 2. API y worker

Imagen: `docker build -f apps/api/Dockerfile -t indice-api .` (desde la raíz del repo).

| Proceso | Comando                           | Notas                                                                                         |
| ------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| API     | `node dist/main.js` (por defecto) | Expone `PORT` (3000). Health check: `GET /api/v1/health`                                      |
| Worker  | `node dist/worker.js`             | Una sola instancia: Mercado Central (14 y 18 h), índice (cada hora), limpieza de idempotencia |

Variables de entorno (ver `.env.example`):

| Variable                                  | Producción                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                                | `production`                                                            |
| `DATABASE_URL`                            | URL del Postgres gestionado                                             |
| `DB_POOL_SIZE`                            | 20 por instancia (ajustar al límite de conexiones del proveedor)        |
| `IP_HASH_SECRET`                          | `openssl rand -hex 32`; no cambiarlo después (rompe los límites por IP) |
| `REDIS_URL`                               | Obligatoria en producción                                               |
| `TURNSTILE_SECRET_KEY`                    | La clave secreta real (la API rechaza las de prueba en producción)      |
| `TRUST_CLOUDFLARE`                        | `true`: la IP real sale de `CF-Connecting-IP`                           |
| `TRUST_PROXY_HOPS`                        | Proxies propios del host entre Cloudflare y la app (normalmente 1)      |
| `CORS_ORIGIN`                             | El dominio de la web, por ejemplo `https://<dominio-de-la-web>`         |
| `PLAUSIBLE_MIN_PPK` / `PLAUSIBLE_MAX_PPK` | Respaldo del rango plausible sin datos del Mercado Central              |

Importante: la API tiene que aceptar tráfico **solo desde Cloudflare** (reglas de firewall del host o un túnel). Si no, cualquiera puede mandar un `CF-Connecting-IP` falso y saltear los límites por IP.

## 3. Web

En Vercel, importar el repo con la raíz como _Root Directory_. `vercel.json` ya define instalación, build, salida, reescritura de rutas de la SPA y cabeceras de caché (`sw.js` sin caché, `assets/` inmutables).

| Variable                  | Valor                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `VITE_API_URL`            | URL pública de la API, por ejemplo `https://<dominio-de-la-api>/api/v1` |
| `VITE_TURNSTILE_SITE_KEY` | La _site key_ del widget de Turnstile                                   |

Agregar el dominio de la web al widget de Turnstile y a `CORS_ORIGIN` de la API.

## 4. Verificación después del deploy

- `GET /api/v1/health` responde `{"status":"ok"}`.
- `GET /api/v1/reference/latest` trae `source: "Mercado Central de Buenos Aires"`.
- En la web: elegir una zona, ver Inicio, cargar un precio de prueba y borrarlo a mano de la base.
- Los logs del worker muestran la importación de las 14 h y el recálculo horario del índice.

## Decisiones abiertas para el lanzamiento

- Proveedores concretos de Postgres, Redis y contenedores (el código no depende de ninguno).
- Tiles del mapa: hoy usa `tile.openstreetmap.org`, cuya política de uso no admite tráfico de producción alto. Para el lanzamiento conviene un proveedor de tiles (MapTiler, Stadia, Protomaps) y cambiar la URL en `PriceMap.tsx` y `PinPicker.tsx`.
