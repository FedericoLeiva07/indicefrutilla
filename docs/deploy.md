# Deploy

Postgres con PostGIS, Redis, la API y el worker van en **Railway**; la web, en **Vercel**. Este repo deja todo listo; **crear las cuentas y hacer el primer deploy lo hace una persona**.

## Cómo queda protegida la API

```
navegador ──► Vercel (web + middleware /api/*) ──► Railway: api ──► postgis, redis (red privada)
                     agrega X-Proxy-Secret                  worker ──┘
                     y X-Client-IP
```

- La web llama a `/api/v1/...` en su propio dominio. El middleware de Vercel (`apps/web/middleware.ts`) reenvía a Railway agregando `X-Proxy-Secret` y la IP real del visitante en `X-Client-IP`. Pisa cualquier `X-Client-IP` que mande el navegador.
- La API rechaza con `403 FORBIDDEN` todo lo que no traiga el secreto, salvo `GET /api/v1/health` (lo usa el health check de Railway). La URL pública de Railway no sirve para usar la API directamente.
- El middleware rechaza pedidos de otros sitios (`Sec-Fetch-Site: cross-site`), así que otra página no puede usar la API desde el navegador de sus visitantes.
- Postgres y Redis no tienen acceso público: solo se alcanzan por la red privada de Railway.
- Lo que no se puede evitar es que alguien use la API desde un script pasando por el dominio de la web, porque todo lo que hace el navegador se puede repetir. Contra eso están los límites por IP y por dispositivo (§6) y Turnstile en las cargas.

## 1. Railway

Un proyecto con cuatro servicios.

### postgis

1. _New → Docker Image_: `postgis/postgis:16-3.4`.
2. Volumen montado en `/var/lib/postgresql/data`.
3. Variables:

| Variable            | Valor                             |
| ------------------- | --------------------------------- |
| `POSTGRES_USER`     | `indice`                          |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24`            |
| `POSTGRES_DB`       | `indice`                          |
| `PGDATA`            | `/var/lib/postgresql/data/pgdata` |

4. **Sin dominio público ni TCP proxy.**

### redis

1. _New → Database → Redis_.
2. En _Settings → Networking_, **quitar el TCP proxy público** si lo creó.

### api

1. _New → GitHub repo_, este repo, sin _Root Directory_ (el Dockerfile copia `packages/shared`).
2. No hace falta configurar el build: Railway toma `railway.json` de la raíz del repo, que define el Dockerfile, `node dist/migrate.js` como _pre-deploy_, el health check y el reinicio. Si en los logs del build aparece _Railpack_ en vez del Dockerfile, no está leyendo ese archivo.
3. _Settings → Networking_: generar un dominio público (`*.up.railway.app`). Es lo que va en `API_ORIGIN` de Vercel.
4. Variables:

| Variable               | Valor                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV`             | `production`                                                                            |
| `DATABASE_URL`         | `postgres://indice:${{postgis.POSTGRES_PASSWORD}}@postgis.railway.internal:5432/indice` |
| `REDIS_URL`            | `${{redis.REDIS_URL}}` (la interna, `redis.railway.internal`)                           |
| `PROXY_SECRET`         | `openssl rand -hex 32`. El mismo valor va en Vercel como `API_PROXY_SECRET`             |
| `IP_HASH_SECRET`       | `openssl rand -hex 32`. No cambiarlo después (rompe los límites por IP)                 |
| `TURNSTILE_SECRET_KEY` | La clave secreta real del widget (la API rechaza las de prueba en producción)           |
| `CORS_ORIGIN`          | El dominio de la web, por ejemplo `https://<dominio-de-la-web>`                         |
| `DB_POOL_SIZE`         | `10`                                                                                    |

`PORT` lo pone Railway. `TRUST_CLOUDFLARE` queda en `false`: no se puede combinar con `PROXY_SECRET`.

La primera vez, el _pre-deploy_ aplica las migraciones, carga las zonas de Georef y el histórico del Mercado Central (unos segundos). En los deploys siguientes solo aplica migraciones nuevas.

### worker

1. Mismo repo. En _Settings → Config-as-code → Railway Config File_ poner `/apps/api/railway.worker.json` (ruta absoluta, con la barra inicial). Si no, toma el `railway.json` de la raíz y arranca como API.
2. **Sin dominio público.** Una sola réplica: corre el Mercado Central (14 y 18 h), el índice (cada hora) y la limpieza de idempotencia.
3. Las mismas variables que `api`. Conviene definirlas como _Shared Variables_ del proyecto o referenciarlas (`${{api.PROXY_SECRET}}`).

## 2. Vercel

1. Importar el repo con **Root Directory `apps/web`** (deja activado _Include files outside the root directory_; hace falta `packages/shared`).
2. `apps/web/vercel.json` define instalación, build, salida, reescritura de la SPA y cabeceras de caché.
3. Variables:

| Variable                  | Valor                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| `API_ORIGIN`              | El dominio público del servicio `api`: `https://<algo>.up.railway.app` |
| `API_PROXY_SECRET`        | El mismo valor que `PROXY_SECRET` en Railway                           |
| `VITE_TURNSTILE_SITE_KEY` | La _site key_ del widget de Turnstile                                  |

`VITE_API_URL` no se define: la web usa `/api/v1` en su mismo dominio.

4. Agregar el dominio de la web al widget de Turnstile.

## 3. Rotar el secreto del proxy

Cambiar `PROXY_SECRET` en Railway (`api` y `worker`) y `API_PROXY_SECRET` en Vercel, y redeployar los dos. Mientras uno tiene el valor nuevo y el otro el viejo, la API responde 403.

## 4. Verificación después del deploy

- `curl https://<api>.up.railway.app/api/v1/health` responde `{"status":"ok"}`.
- `curl https://<api>.up.railway.app/api/v1/geo/provinces` responde `403` con `FORBIDDEN`.
- `curl https://<web>/api/v1/reference/latest` trae `source: "Mercado Central de Buenos Aires"`.
- En la web: elegir una zona, ver Inicio, cargar un precio de prueba y borrarlo a mano de la base.
- Los logs del _pre-deploy_ muestran Georef y el Mercado Central; los del worker, el recálculo horario del índice.

## Pendiente para el lanzamiento

- Tiles del mapa: hoy usa `tile.openstreetmap.org`, cuya política de uso no admite tráfico de producción alto. Para el lanzamiento conviene un proveedor de tiles (MapTiler, Stadia, Protomaps) y cambiar la URL en `PriceMap.tsx` y `PinPicker.tsx`.
