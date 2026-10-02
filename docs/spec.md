# Índice Frutilla — Spec del MVP

Versión 1 · 2026-10-01 · Fuente de verdad para el desarrollo.

Referencias:

- Plan técnico (contexto y arquitectura): https://claude.ai/artifact/Ky4TNre7nLcqW67A81sXhU
- Mockup (pantallas y estados): https://claude.ai/artifact/G9TqodcrehPK8yms5tGnb5

Este spec reemplaza al plan técnico donde se contradicen. Los IDs de pantalla (`1`–`7`, `D1`–`D6`, `E1`–`E9`, `C1`–`C12`) son los títulos de los artboards del mockup.

---

## 1. Alcance

**Entra en el MVP**

- Consulta de precios cercanos en lista y mapa, por ubicación actual o por zona elegida.
- Índice semanal en $/kg por partido/departamento, provincia y país, con histórico.
- Carga de precio en 3 pasos (comercio, precio, confirmación), sin cuenta.
- Votos "sigue / ya no está" y denuncias.
- Referencia mayorista del Mercado Central de Buenos Aires.
- Lanzamiento en todo el país.
- PWA instalable con la última consulta disponible sin conexión.

**Queda afuera**

- Fotos del cartel (sin Cloudinary, sin subida de archivos).
- Cuentas de usuario.
- Revisión manual de ofertas y panel de administración. Sin nadie que revise, no hay estado "en revisión": un precio fuera del rango plausible se rechaza (§2.2).
- Índice ajustado por inflación, otras frutas, alertas de precio, app nativa.

**Decisiones cerradas**

| Tema                  | Decisión                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Fotos                 | Fuera del MVP                                                                                  |
| Cobertura             | Nacional desde el lanzamiento                                                                  |
| Presentación          | 250 g, 500 g, 1 kg, Cajón (con kilos), Otro (con gramos)                                       |
| Rango plausible       | Derivado del precio mayorista del Mercado Central, no de p5–p95 propio                         |
| Vencimiento           | "Vencida" es un cálculo de visibilidad, no un estado: el índice histórico conserva sus ofertas |
| Zonas del índice      | Partido/departamento → provincia → país → referencia mayorista                                 |
| Calidad en el índice  | Solo Primera. Segunda se muestra en lista y mapa, pero no entra al índice                      |
| Precio fuera de rango | Se rechaza (`PRICE_OUT_OF_RANGE`); no hay cola de revisión en el MVP                           |

---

## 2. Dominio

### 2.1 Presentación y normalización

| `presentation` | Peso              | Cómo se obtiene `quantity_g`           |
| -------------- | ----------------- | -------------------------------------- |
| `g250`         | 250 g             | fijo                                   |
| `g500`         | 500 g             | fijo                                   |
| `kg1`          | 1000 g            | fijo                                   |
| `cajon`        | 2, 4, 5 kg u otro | elegido por el usuario, 1.000–10.000 g |
| `otro`         | libre             | ingresado en gramos, 50–10.000 g       |

- `price_per_kg = round(price_ars / (quantity_g / 1000), 2)`.
- `price_ars`: entero o con hasta 2 decimales, entre 1 y 10.000.000.
- En la UI, el precio se escribe con separador de miles (`9.200`) y se envía como número.
- `quality`: `primera` | `segunda`.

### 2.2 Estados de una oferta

```
crear ── dentro del rango plausible ──► active ── 3 denuncias ──► flagged
  │
  └── fuera del rango ──► rechazada (422 PRICE_OUT_OF_RANGE, no se guarda)
```

| Estado    | Visible en lista y mapa         | Cuenta en el índice                     |
| --------- | ------------------------------- | --------------------------------------- |
| `active`  | Sí, si está vigente (ver abajo) | Sí, siempre (aunque ya no esté vigente) |
| `flagged` | No                              | No                                      |

**Vigente** = `status = active`, `observed_at` dentro de los últimos 7 días (hora de Argentina) y saldo de votos > −3.

- Una oferta no vigente desaparece de lista y mapa, pero **sigue contando en el índice de su semana**.
- Esto corrige el bug del plan original, donde el histórico quedaba vacío.

**Umbrales de la comunidad.** Todos cuentan dispositivos distintos **con IP-hash distintos**:

- 3 denuncias → `flagged`.
- Saldo de votos ≤ −3 → deja de estar vigente.

**Sin revisión en el MVP:**

- `flagged` es definitivo: no hay quién restaure una oferta.
- Si se ve abuso de denuncias, se corrige a mano en la base.
- Los estados `pending_review` y `hidden` y los endpoints de admin quedan para cuando exista un panel (§11).

### 2.3 Zonas

Fuente: API Georef (datos.gob.ar), cargada por seed.

| Nivel                                    | Uso                                         |
| ---------------------------------------- | ------------------------------------------- |
| Provincia                                | Índice, selector                            |
| Departamento / partido (comunas en CABA) | Índice local por defecto, selector          |
| Localidad                                | Solo selector: define el centro de búsqueda |

- Cada comercio guarda `province_id` y `department_id` al crearse.
- La resolución de un punto (`/geo/resolve`) devuelve provincia, departamento y localidad.
- **Verificado (2026-10-01):** Georef publica los polígonos de los 529 departamentos, incluidas las 15 comunas de CABA (`infra.datos.gob.ar/georef/departamentos.geojson`).
  - La resolución se hace localmente con PostGIS: el departamento que contiene el punto, o el más cercano a menos de 5 km (puntos sobre la costa o un límite, donde los polígonos simplificados no llegan).
  - Ningún departamento a menos de 5 km → `OUTSIDE_COVERAGE`.

---

## 3. Índice

### 3.1 Cálculo

- **Semana:** de lunes a domingo, por `observed_at`, en zona horaria `America/Argentina/Buenos_Aires`.
- **Ofertas elegibles:** `status = active` y `quality = primera`.
- **Paso 1:** precio por comercio y semana = mediana del `price_per_kg` de las ofertas de ese comercio en esa semana. Así un comercio con muchas cargas no pesa más que otro.
- **Paso 2:** índice de la zona = mediana de los precios por comercio. p25 y p75 se calculan sobre esos mismos valores.
- **Publicación:** solo si hay **≥ 5 ofertas y ≥ 3 comercios** en la zona y la semana. Si no, se informa `published: false` con los conteos ("Esta semana hay 2", pantalla E2).
- **Variación semanal:** solo si la semana actual y la anterior están publicadas.
- **Ventanas de 4 y 12 semanas (D3):** mediana de los precios por comercio y semana de toda la ventana. Se calcula al vuelo; no se promedian medianas.

### 3.2 Jerarquía y fallback (Inicio, E2)

Inicio muestra el primer nivel publicado de esta cadena:

1. Departamento de la ubicación.
2. Provincia.
3. País.
4. Referencia mayorista, rotulada "Mayorista · Mercado Central de Buenos Aires".

E2 muestra la zona sin datos y "Mientras tanto, <nivel publicado>".

### 3.3 Almacenamiento y refresco

- Tabla `price_index_weekly` (no una vista materializada), con PK `(week_start, level, zone_id)` y `zone_id = 'AR'` para el país. Así se evita el problema de los NULL de `GROUPING SETS`.
- El job horario recalcula la semana actual y la anterior. La anterior se incluye porque se pueden cargar ofertas de hasta 2 días atrás.
- Cuando una oferta pasa a `flagged`, se encola el recálculo de su semana.

---

## 4. Referencia mayorista (Mercado Central)

Fuente verificada el 2026-10-01: https://mercadocentral.gob.ar/información/precios-mayoristas

- Publica un ZIP por mes con un `.XLS` por día hábil (BIFF8). Los archivos aparecen alrededor de las 13 h.
- La frutilla está presente todos los días hábiles de enero a septiembre de 2026.

### 4.1 Importador (`reference-prices`, en el worker)

- **Frecuencia:** días hábiles a las 14:00 y a las 18:00 (hora de Argentina).
- **Paso 1:** descargar el HTML de la página y tomar los links `.zip` cuyo nombre matchee `/FRUT/i`.
  - **No construir los nombres:** hay variantes reales como `FRUTRAS_AGOSTO-26_0.zip` o `FRUTAS%20%20ENERO-26_0.zip`.
- **Paso 2:** bajar el ZIP del mes actual y el del anterior. Leer solo los `RF*.XLS` e ignorar `.rar` y ZIPs anidados.
- **Paso 3:** parsear con SheetJS. Columnas: `ESP, VAR, PROC, ENV, KG, CAL, TAM, GRADO, MA<fecha>, MO<fecha>, MI<fecha>, MAPK, MOPK, MIPK`.
  - La fecha sale del nombre del archivo: `RFddmmyy`.
- **Paso 4:** filtrar `ESP = 'FRUTILLA'` y `VAR <> 'Prom.Esp.'`.
- **Paso 5:** usar solo `MOPK` (precio más frecuente por kg). Descartar la fila si `MOPK < MIPK` o `MOPK > MAPK`.
  - Hay errores de tipeo reales: el 04/09/26 figura un máximo de $220.000 por $22.000.
- **Paso 6:** upsert en `reference_prices` por `(date, origin, package, kg, quality, size)`.
- **Atribución:** citar "Fuente: Mercado Central de Buenos Aires" donde se muestre el dato.

### 4.2 Valores derivados

- **Referencia diaria:** mediana de `MOPK` de las filas del día.
- **Referencia vigente:** mediana de las referencias diarias de los últimos 7 días hábiles con datos.
- **Rango plausible:** `[0,7 × referencia vigente, 4 × referencia vigente]`.
  - Sin datos en los últimos 14 días, se usa `PLAUSIBLE_MIN_PPK` / `PLAUSIBLE_MAX_PPK` del entorno.
  - Contexto: en 2026 el mayorista pasó de ~$23.000/kg en junio a ~$4.200/kg a fin de septiembre. Por eso el rango tiene que moverse con la referencia.

---

## 5. API

Base `/api/v1`. Las lecturas son públicas.

- Toda escritura exige `X-Device-Id` (UUID v4 generado por el navegador).
- `POST /stores` y `POST /reports` exigen además un token de Turnstile y aceptan `Idempotency-Key`.
- Las coordenadas se redondean a 3 decimales en el cliente antes de enviarse.

### 5.1 Endpoints

| Método | Ruta                                                          | Uso (pantallas)                                                                         |
| ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/geo/provinces`                                              | 2, D2, E5                                                                               |
| GET    | `/geo/provinces/:id/departments`                              | 2, D2                                                                                   |
| GET    | `/geo/departments/:id/localities`                             | 2, D2                                                                                   |
| GET    | `/geo/resolve?lat&lng`                                        | Ubicación actual → zona. `OUTSIDE_COVERAGE` → E6                                        |
| GET    | `/index/summary?departmentId` (o `provinceId`)                | 1, E1, E2: cadena de niveles + histórico de 8 semanas del nivel mostrado + referencia   |
| GET    | `/index/provinces?weeks=1\|4\|12`                             | D3                                                                                      |
| GET    | `/index/history?level&id&weeks=12`                            | Gráficos                                                                                |
| GET    | `/reference/latest`                                           | `{date, modalPpk, plausibleMin, plausibleMax, source}`. Lo usa C4 y el fallback de E2   |
| GET    | `/reports?lat&lng&radius&sort=price\|distance\|recent&cursor` | 3, 4, D1, E4. Solo ofertas vigentes; con `X-Device-Id` suma `myVote`                    |
| GET    | `/reports/:id`                                                | Detalle. `REPORT_UNAVAILABLE` (410) → E9                                                |
| GET    | `/stores/nearby?lat&lng&radius`                               | 5, D4                                                                                   |
| GET    | `/stores/search?q&lat&lng&radius=3000`                        | 5, D4. Lista vacía → C1                                                                 |
| POST   | `/stores`                                                     | C1 → C2. Responde `STORE_POSSIBLE_DUPLICATE` salvo que llegue `confirmedDistinct: true` |
| POST   | `/reports`                                                    | 7, C5 → C6 / C4 / C9–C12                                                                |
| POST   | `/reports/:id/votes`                                          | `{value: 1\|-1}` → E7                                                                   |
| POST   | `/reports/:id/flags`                                          | `{reason}` → E8                                                                         |

- Radio de búsqueda: 1, 3, 5 o 10 km en la UI; la API acepta de 100 m a 20 km. Por defecto, 3 km.
- Detección de duplicados en `POST /stores`: hay un comercio a ≤ 50 m con `similarity(name_normalized, :name) ≥ 0,4` (`pg_trgm`).
  - La respuesta incluye hasta 3 candidatos con su distancia y su cantidad de ofertas.

### 5.2 `POST /reports`

```http
POST /api/v1/reports
X-Device-Id: 3f6c2a9e-…
Idempotency-Key: 9b1d…            (uno por borrador, se reusa en los reintentos)
Content-Type: application/json

{
  "storeId": 1842,
  "priceArs": 9200,
  "presentation": "cajon",
  "quantityG": 2000,              // obligatorio solo para cajon y otro
  "quality": "primera",
  "observedAt": "2026-10-01",     // hoy, ayer o hace 2 días; nunca futuro
  "reporterName": "Fede",         // opcional, se recorta y queda en máximo 30 caracteres
  "turnstileToken": "0.AbC…"
}
```

Respuesta `201`:

```json
{
  "report": { "id": 51234, "pricePerKg": 4600 },
  "zone": { "level": "department", "id": "06840", "name": "Tres de Febrero" },
  "comparison": { "zoneMedian": 5200, "diffPct": -11 }
}
```

- La oferta siempre se crea `active` → C6.
- Si el $/kg cae fuera del rango plausible → `PRICE_OUT_OF_RANGE` (422), con `details: { plausibleMin, plausibleMax, pricePerKg }`, y no se guarda.
- `comparison` es `null` si la zona no tiene índice publicado.
- Si llega una `Idempotency-Key` ya usada por el mismo `device_id` con el mismo cuerpo, se devuelve la respuesta guardada (24 h).
- Si llega con otro cuerpo → `IDEMPOTENCY_CONFLICT` (409).

### 5.3 Formato de error

```json
{
  "error": {
    "code": "DAILY_LIMIT_REACHED",
    "message": "…",
    "retryAfterSeconds": 3600,
    "details": []
  }
}
```

`details` lleva errores por campo: `[{ "field": "quantityG", "code": "required" }]`. La UI muestra el código como `E-<status HTTP>` (por ejemplo E-503, pantalla E4).

| `code`                     | HTTP | Cuándo                                          | Pantalla                                         |
| -------------------------- | ---- | ----------------------------------------------- | ------------------------------------------------ |
| `VALIDATION_FAILED`        | 400  | DTO inválido                                    | C3                                               |
| `STORE_NOT_FOUND`          | 422  | `storeId` inexistente                           | volver al paso 1                                 |
| `PRICE_OUT_OF_RANGE`       | 422  | $/kg fuera del rango plausible (§4.2)           | C4                                               |
| `STORE_POSSIBLE_DUPLICATE` | 409  | comercio parecido cerca                         | C2                                               |
| `TURNSTILE_FAILED`         | 403  | token inválido o vencido                        | C11                                              |
| `RATE_LIMITED`             | 429  | límite por segundo o minuto; trae `Retry-After` | C9                                               |
| `DAILY_LIMIT_REACHED`      | 429  | tope diario por dispositivo o IP                | C10                                              |
| `ALREADY_VOTED`            | 409  | voto repetido del mismo dispositivo             | E7 ("Ya votaste…")                               |
| `ALREADY_FLAGGED`          | 409  | denuncia repetida                               | aviso breve                                      |
| `REPORT_UNAVAILABLE`       | 410  | no vigente o `flagged`; trae `details.reason`   | E9                                               |
| `OUTSIDE_COVERAGE`         | 404  | punto fuera de Argentina                        | E6                                               |
| `IDEMPOTENCY_CONFLICT`     | 409  | misma clave con otro cuerpo                     | C12 (variante servidor)                          |
| `INTERNAL`                 | 5xx  | error del servidor                              | E4 / C12 ("Tuvimos un problema de nuestro lado") |
| sin respuesta              | —    | red caída o timeout de 15 s                     | C12 / E3                                         |

---

## 6. Abuso y límites

| Límite                     | Por IP        | Por `device_id` |
| -------------------------- | ------------- | --------------- |
| Ráfaga, cualquier endpoint | 5 por segundo | —               |
| Escrituras (`POST`)        | 10 por minuto | 5 por minuto    |
| Ofertas                    | 40 por día    | 20 por día      |
| Comercios nuevos           | 10 por día    | 5 por día       |

- **Dónde se aplica cada límite:** los de segundo y minuto, `@nestjs/throttler` (Redis desde la etapa 2). Los diarios se cuentan en la base y se reinician a las 00:00 de Argentina (C10: "Se renueva a las 00:00").
- **IP-hash:** `ip_hash = HMAC-SHA256(ip, IP_HASH_SECRET)`. La IP en claro no se guarda nunca.
- **IP real:** se toma de `CF-Connecting-IP`, con `trust proxy` configurado.
- **Turnstile:** el token es de un solo uso. Cada reintento (C9, C11, C12) pide un token nuevo antes de reenviar.

---

## 7. Frontend

### 7.1 Estado local (localStorage, con prefijo `indice.`)

| Clave         | Contenido                                                                                     | Se borra                                          |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `device.v1`   | UUID del dispositivo                                                                          | nunca                                             |
| `name.v1`     | último nombre usado (paso 3)                                                                  | al elegir "Anónimo" no se borra; solo no se envía |
| `location.v1` | zona elegida (ids y radio), o coordenadas redondeadas                                         | al cambiar de ubicación                           |
| `draft.v1`    | carga en curso: comercio, precio, presentación, `quantityG`, calidad, fecha, `idempotencyKey` | al publicar con éxito                             |

- Toda lectura o escritura va en `try/catch`. Si localStorage no está disponible, la app funciona igual (sin recordar nada).
- C9, C11 y C12 dicen que los datos quedaron guardados: eso es `draft.v1`. Al volver al flujo, se retoma el borrador.

### 7.2 Ubicación

- Geolocation API con un timeout de 10 s.
  - Si se deniega → E5 ("No tenemos permiso para ubicarte").
  - Si hay timeout o error → E5 con "No pudimos obtener tu ubicación".
- Las coordenadas se resuelven con `/geo/resolve`. `OUTSIDE_COVERAGE` → E6.

### 7.3 Sin conexión (E3)

- Service worker (vite-plugin-pwa) para el app shell.
- La última respuesta de `/index/summary` y `/reports` se persiste con el persister de TanStack Query.
- Banner "Sin conexión. Estás viendo los precios guardados hace X".
- "Cargar precio" queda deshabilitado con "Para cargar un precio hace falta conexión".
- Los tiles del mapa no se cachean.

### 7.4 Validación en el paso 2 (C3, C4)

- **C3:** campos requeridos.
  - Precio > 0.
  - Presentación elegida.
  - Si es `cajon`: kilos elegidos (o un valor de 1 a 10 kg).
  - Si es `otro`: gramos (de 50 a 10.000).
- **C4:** si el $/kg cae fuera del rango plausible de `/reference/latest`, se bloquea el avance con "Corregir el precio".
  - El aviso muestra p25–p75 de la zona como rango habitual. Si la zona no tiene índice, se omite el rango.
  - El servidor vuelve a validar y responde `PRICE_OUT_OF_RANGE`. Si llega ese error (por ejemplo, porque la referencia cambió entre pasos), se vuelve a C4.

---

## 8. Datos

```
provinces        (id text pk, name, centroid geography(Point))
departments      (id text pk, province_id fk, name, centroid, geom geography(MultiPolygon) null)
localities       (id text pk, department_id fk, province_id fk, name, centroid)
stores           (id bigint identity pk, name, name_normalized, address, location geography(Point) GIST,
                  province_id fk, department_id fk, created_by_device uuid, created_ip_hash bytea, created_at)
                  idx gin(name_normalized gin_trgm_ops)
reports          (id bigint identity pk, store_id fk, price_ars numeric(12,2), presentation enum, quantity_g int,
                  price_per_kg numeric(12,2), quality enum, observed_at date, reporter_name varchar(30) null,
                  device_id uuid, ip_hash bytea, status enum, created_at timestamptz)
                  idx (store_id, observed_at desc), (status, observed_at), (device_id, created_at), (ip_hash, created_at)
report_votes     (report_id, device_id, ip_hash, value smallint, created_at)       unique(report_id, device_id)
report_flags     (report_id, device_id, ip_hash, reason enum, created_at)         unique(report_id, device_id)
price_index_weekly (week_start date, level enum, zone_id text, median_ppk, p25_ppk, p75_ppk,
                  sample_size int, store_count int, published bool, computed_at)  pk(week_start, level, zone_id)
reference_prices (date, origin, package, kg numeric, quality, size, min_ppk, modal_ppk, max_ppk, source_file)
                  pk(date, origin, package, kg, quality, size)
idempotency_keys (key uuid pk, device_id uuid, request_hash bytea, status_code int, response jsonb, created_at)
```

- `reason`: `precio_falso` | `duplicada` | `spam`.
- `status`: `active` | `flagged`. **No existe `expired`.** Agregar estados después es una migración de enum sin cambios de datos.

---

## 9. Mapa de pantallas y estados

### 9.1 Flujo principal

| ID     | Pantalla               | Fuente de datos                        | Criterio de aceptación                                                                                                    |
| ------ | ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1 / D1 | Inicio / Explorar      | `/index/summary`, `/reports`           | Muestra el nivel publicado más chico (§3.2), el histórico de 8 semanas, p25, p75 y la muestra                             |
| 2 / D2 | Elegir ubicación       | `/geo/*`                               | "Usar mi ubicación" o provincia → departamento → localidad + radio; "Ver todo el país" lleva a D3 o al índice nacional    |
| 3      | Mapa                   | `/reports`                             | Pines con $/kg; la ficha tiene votos y "Cómo llegar"                                                                      |
| 4      | Lista                  | `/reports`                             | Orden por precio, distancia o fecha; "N ofertas de los últimos 7 días"                                                    |
| D3     | Índice nacional        | `/index/provinces`                     | Filas por provincia con mediana, variación, p25–p75 y ofertas; las provincias sin umbral muestran "Sin datos suficientes" |
| 5 / D4 | Cargar 1/3 · Comercio  | `/stores/nearby`, `/stores/search`     | Elegir un comercio cercano, buscar o agregar uno nuevo                                                                    |
| 6 / D5 | Cargar 2/3 · Precio    | `/reference/latest`, índice de la zona | Presentación con Cajón y kilos; "Equivale a" en vivo; sin foto                                                            |
| 7 / D6 | Cargar 3/3 · Confirmar | `POST /reports`                        | Nombre (precargado de `name.v1`) o anónimo                                                                                |

### 9.2 Estados de consulta

| ID  | Estado               | Disparador                              | Comportamiento                                                                                   |
| --- | -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| E1  | Cargando             | Request de Inicio en curso              | Skeleton; si tarda más de 15 s, pasa a E4                                                        |
| E2  | Sin datos en la zona | `published: false` y/o `/reports` vacío | Conteo actual, fallback (§3.2), "Ampliar a 10 km", "Ver la provincia", "Cargar el primer precio" |
| E3  | Sin conexión         | Sin red, con cache                      | Datos persistidos con su antigüedad; carga deshabilitada                                         |
| E4  | Error al cargar      | 5xx o timeout                           | "Reintentar" y código `E-<status>`                                                               |
| E5  | Permiso denegado     | Geolocation denegada o con error        | Selector manual de zona                                                                          |
| E6  | Fuera de Argentina   | `OUTSIDE_COVERAGE`                      | "Elegir una zona" / "Ver todo el país"                                                           |
| E7  | Voto registrado      | `201` o `ALREADY_VOTED`                 | Contador actualizado; botones deshabilitados con "Ya votaste esta oferta desde este dispositivo" |
| E8  | Denunciar            | Toque en "Denunciar esta oferta"        | 3 motivos (§8); un envío por dispositivo                                                         |
| E9  | Oferta no disponible | `REPORT_UNAVAILABLE`                    | Explica el motivo y quita el pin; "Ver otras ofertas cerca"                                      |

### 9.3 Estados de carga

| ID  | Estado                      | Disparador                                             | Comportamiento                                                                                                                                 |
| --- | --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Sin resultados              | `/stores/search` vacío                                 | "Agregar '<nombre>'" lleva a la alta de comercio                                                                                               |
| C2  | Posible duplicado           | `STORE_POSSIBLE_DUPLICATE`                             | "Es este" usa el candidato; "No, es otro" reenvía con `confirmedDistinct: true`                                                                |
| C3  | Errores de validación       | Validación del cliente o `VALIDATION_FAILED`           | Resumen "Revisá N datos" y un error por campo                                                                                                  |
| C4  | Precio fuera de lo habitual | $/kg fuera del rango plausible, o `PRICE_OUT_OF_RANGE` | Bloquea; solo "Corregir el precio"                                                                                                             |
| C5  | Publicando                  | `POST /reports` en curso                               | Botón deshabilitado con spinner; sin barra de progreso                                                                                         |
| C6  | Publicado                   | `201`                                                  | Calidad Primera: "Ya cuenta para el índice de <zona>". Segunda: "Ya aparece en el mapa" (no entra al índice). "Ver en el mapa" / "Cargar otro" |
| C7  | ~~En revisión~~             | —                                                      | **Fuera del MVP** (no hay revisión manual)                                                                                                     |
| C8  | ~~Publicado sin foto~~      | —                                                      | **Se elimina** (no hay fotos)                                                                                                                  |
| C9  | Demasiados intentos         | `RATE_LIMITED`                                         | Cuenta regresiva según `Retry-After`; después se reintenta con un token nuevo                                                                  |
| C10 | Límite diario               | `DAILY_LIMIT_REACHED`                                  | "Se renueva a las 00:00"; solo "Volver al inicio"                                                                                              |
| C11 | Verificación fallida        | `TURNSTILE_FAILED`                                     | "Intentar de nuevo" pide otro token y reenvía con la misma `Idempotency-Key`                                                                   |
| C12 | Error al publicar           | Sin respuesta o 5xx                                    | Borrador guardado; "Reintentar publicar" con la misma `Idempotency-Key`                                                                        |

### 9.4 Ajustes al mockup

Aplicados el 2026-10-01:

- se sacaron las fotos (C3, C5, C6, E8) y la revisión (C4, D5, D6);
- se eliminó C8;
- C7 quedó marcada como post-MVP;
- C3 muestra el error de los kilos del cajón;
- C6 tiene la variante Segunda como tweak.

---------- | --------------------------------------------------------------------------------------------------------- |
| C5 | Quitar "Subiendo la foto 60%" |
| C6 | Quitar "· con foto" |
| C8 | Eliminar el artboard |
| C3 | Reemplazar el error de la foto (HEIC, 8,2 MB) por "Indicá los kilos del cajón"; agregar Cajón a la grilla |
| E8 | Quitar el motivo "La foto no corresponde o es ofensiva" |
| C7 | Marcar como post-MVP (o sacarlo del flujo) |
| C4 | Quitar "Sí, es correcto" y el texto "lo revisamos antes de sumarlo al índice" |
| D5 | Quitar "pasa por una revisión antes de sumarse al índice" del texto lateral |
| D6 | Quitar el mismo texto de revisión |
| C6 | Agregar la variante Segunda: "Ya aparece en el mapa" |
| Artboard 1 | Eliminar (vacío, con el texto "oer") |

---

## 10. Plan de implementación (6 semanas)

1. **Base.** Monorepo pnpm (`apps/web`, `apps/api`, `packages/shared`), Docker con `postgis/postgis:16`, migraciones TypeORM, seed de Georef (provincias, departamentos, localidades) y verificación de geometrías, CI, formato de error, `DeviceGuard`.
2. **Backend de carga.** Stores (nearby, search, alta con detección de duplicados), `POST /reports` (normalización, rango plausible, idempotencia, límites, Turnstile), importador del Mercado Central.
3. **Frontend de consulta.** Ubicación (E5, E6), Inicio con summary (E1, E2), lista y mapa (E4), persistencia sin conexión (E3).
4. **Frontend de carga.** Pasos 1–3 con borrador (C1–C6, C9–C12).
5. **Índice y comunidad.** Job semanal y endpoints (D3, histórico), votos y denuncias (E7–E9).
6. **Lanzamiento.** PWA, e2e con Playwright que cubra cada estado de §9, prueba de carga contra los límites, deploy (Postgres con PostGIS, Redis, API y worker en Railway; web en Vercel, que hace de proxy de la API con un secreto compartido; ver `docs/deploy.md`).

---

## 11. Decisiones abiertas

1. **Factores del rango plausible** (0,7× y 4×). Hay que ajustarlos con datos reales del primer mes. Con el rechazo duro, un factor demasiado estrecho bloquea precios reales.
2. **Revisión manual (post-MVP).** Cuando exista un panel de admin, se suman:
   - los estados `pending_review` y `hidden`;
   - la pantalla C7;
   - la opción "Sí, es correcto" en C4;
   - la restauración de ofertas `flagged`.
