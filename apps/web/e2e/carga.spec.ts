import type { Page } from '@playwright/test';
import { type ApiMock, apiError, expect, json, prepare, STORES, test } from './fixtures';

async function toStep2(page: Page) {
  await page.goto('/cargar');
  await page.getByRole('radio', { name: /Verdulería Don Tito/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: '¿Cuánto estaban?' })).toBeVisible();
}

async function fillCajon(page: Page, price = '9200') {
  await page.getByLabel('Precio del cartel').fill(price);
  await page.getByRole('button', { name: 'Cajón' }).click();
  await page.getByRole('button', { name: '2 kg' }).click();
}

async function toStep3(page: Page) {
  await toStep2(page);
  await fillCajon(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá y publicá' })).toBeVisible();
}

function reportPosts(api: ApiMock) {
  return api.calls.filter((c) => c.path === '/reports' && c.method === 'POST');
}

test.describe('Paso 1: comercio (5, C1, C2)', () => {
  test('lista los comercios cercanos y busca (5)', async ({ page }) => {
    const api = await prepare(page);
    api.use(
      (route, url) =>
        url.pathname.endsWith('/stores/search') && json(route, 200, [STORES[1]]).then(() => true),
    );
    await page.goto('/cargar');
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await page.getByRole('searchbox', { name: 'Buscar comercio' }).fill('esquina');
    await expect(
      page.getByRole('radiogroup', { name: 'Resultados' }).getByRole('radio'),
    ).toHaveCount(1);
    expect(api.calls.find((c) => c.path === '/stores/search')).toBeTruthy();
  });

  test('sin resultados ofrece agregar el comercio y lo crea (C1)', async ({ page }) => {
    const api = await prepare(page);
    await page.goto('/cargar');
    await page.getByRole('searchbox', { name: 'Buscar comercio' }).fill('Verdulería Pepe');
    await expect(page.getByText('No encontramos "Verdulería Pepe" a menos de 3 km')).toBeVisible();
    await page.getByRole('link', { name: 'Agregar "Verdulería Pepe"' }).click();
    await expect(page.getByLabel('Nombre')).toHaveValue('Verdulería Pepe');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await expect(page.getByText('Escribí la dirección o una referencia')).toBeVisible();
    await page.getByLabel('Dirección').fill('Av. Urquiza 4400');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await expect(page.getByRole('heading', { name: '¿Cuánto estaban?' })).toBeVisible();
    const post = api.calls.find((c) => c.path === '/stores' && c.method === 'POST')!;
    expect(post.body).toMatchObject({
      name: 'Verdulería Pepe',
      address: 'Av. Urquiza 4400',
      turnstileToken: expect.stringMatching(/^token-/),
    });
    expect(post.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('un posible duplicado ofrece usar el existente o confirmar que es otro (C2)', async ({
    page,
  }) => {
    const api = await prepare(page);
    let first = true;
    api.use((route, url) => {
      if (!(url.pathname.endsWith('/stores') && route.request().method() === 'POST' && first))
        return false;
      first = false;
      return apiError(route, 409, 'STORE_POSSIBLE_DUPLICATE', {
        details: { candidates: [{ ...STORES[0], distanceM: 20 }] },
      }).then(() => true);
    });
    await page.goto('/cargar/comercio-nuevo?nombre=Don%20Tito%20verdu');
    await page.getByLabel('Dirección').fill('Av. Urquiza 4100');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await expect(page.getByText(/Encontramos un comercio parecido a 20 m/)).toBeVisible();
    await expect(page.getByText(/Av\. Urquiza 4120 · a 20 m · 14 ofertas/)).toBeVisible();
    await page.getByRole('button', { name: 'No, es otro comercio' }).click();
    await expect(page.getByRole('heading', { name: '¿Cuánto estaban?' })).toBeVisible();
    const posts = api.calls.filter((c) => c.path === '/stores' && c.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toMatchObject({ confirmedDistinct: true });
    expect(posts[1]!.headers['idempotency-key']).toBe(posts[0]!.headers['idempotency-key']);
  });
});

test.describe('Paso 2: precio (6, C3, C4)', () => {
  test('calcula el equivalente por kg en vivo (6)', async ({ page }) => {
    await prepare(page);
    await toStep2(page);
    await expect(page.getByText('Paso 2 de 3')).toBeVisible();
    await fillCajon(page);
    await expect(page.getByLabel('Precio del cartel')).toHaveValue('9.200');
    await expect(page.getByText('$4.600 /kg')).toBeVisible();
    await expect(page.getByText(/12% por debajo de la mediana de Tres de Febrero/)).toBeVisible();
    await expect(page.getByText(/foto/i)).toHaveCount(0);
  });

  test('marca los errores de validación con un resumen (C3)', async ({ page }) => {
    await prepare(page);
    await toStep2(page);
    await page.getByRole('button', { name: 'Cajón' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('alert')).toContainText('Revisá 2 datos');
    await expect(page.getByText('Ingresá el precio que figura en el cartel')).toBeVisible();
    await expect(
      page.getByText('Indicá los kilos del cajón para calcular el precio por kg'),
    ).toBeVisible();
  });

  test('bloquea un precio fuera del rango plausible (C4)', async ({ page }) => {
    await prepare(page);
    await toStep2(page);
    await page.getByLabel('Precio del cartel').fill('25000');
    await page.getByRole('button', { name: '500 g' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Es mucho más que lo habitual en tu zona' }),
    ).toContainText('$4.400 a $6.100 por kg');
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Corregir el precio' }).click();
    await expect(page.getByLabel('Precio del cartel')).toBeFocused();
  });
});

test.describe('Paso 3: confirmar y publicar (7, C5, C6, C9–C12)', () => {
  test('publica con nombre y muestra el éxito (7, C5, C6)', async ({ page }) => {
    const api = await prepare(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    api.use(async (_route, url) => {
      if (!(url.pathname.endsWith('/reports') && _route.request().method() === 'POST'))
        return false;
      await gate;
      return false;
    });
    await toStep3(page);
    await expect(page.getByText('Paso 3 de 3')).toBeVisible();
    await page.getByRole('radio', { name: /Con un nombre/ }).click();
    await page.getByLabel('Nombre o apodo').fill('Fede');
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(page.getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    release();
    await expect(page.getByRole('status')).toHaveText('¡Listo, tu precio ya está publicado!');
    await expect(page.getByText('Ya cuenta para el índice de Tres de Febrero.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver en el mapa' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cargar otro precio' })).toBeVisible();

    const post = reportPosts(api)[0]!;
    expect(post.body).toMatchObject({
      storeId: 201,
      priceArs: 9200,
      presentation: 'cajon',
      quantityG: 2000,
      quality: 'primera',
      reporterName: 'Fede',
      turnstileToken: expect.stringMatching(/^token-/),
    });
    expect(await page.evaluate(() => localStorage.getItem('indice.draft.v1'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('indice.name.v1'))).toBe('"Fede"');
  });

  test('una oferta de segunda dice que no entra al índice (C6)', async ({ page }) => {
    await prepare(page);
    await toStep2(page);
    await fillCajon(page);
    await page.getByRole('button', { name: 'Segunda' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(
      page.getByText('Ya aparece en el mapa. Las ofertas de segunda no entran en el índice.'),
    ).toBeVisible();
  });

  test('RATE_LIMITED muestra la cuenta regresiva y reintenta con un token nuevo (C9)', async ({
    page,
  }) => {
    const api = await prepare(page);
    let first = true;
    api.use((route, url) => {
      if (!(url.pathname.endsWith('/reports') && route.request().method() === 'POST' && first))
        return false;
      first = false;
      return apiError(route, 429, 'RATE_LIMITED', { retryAfterSeconds: 2 }).then(() => true);
    });
    await toStep3(page);
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(page.getByRole('heading', { name: 'Estás cargando muy rápido' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reintentar en 0:0[12]/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click({ timeout: 5000 });
    await expect(page.getByRole('status')).toHaveText('¡Listo, tu precio ya está publicado!');
    const [a, b] = reportPosts(api);
    expect((a!.body as { turnstileToken: string }).turnstileToken).not.toBe(
      (b!.body as { turnstileToken: string }).turnstileToken,
    );
    expect(a!.headers['idempotency-key']).toBe(b!.headers['idempotency-key']);
  });

  test('el límite diario solo deja volver al inicio (C10)', async ({ page }) => {
    const api = await prepare(page);
    api.use(
      (route, url) =>
        url.pathname.endsWith('/reports') &&
        route.request().method() === 'POST' &&
        apiError(route, 429, 'DAILY_LIMIT_REACHED', { retryAfterSeconds: 3600 }).then(() => true),
    );
    await toStep3(page);
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(page.getByRole('heading', { name: 'Llegaste al máximo de hoy' })).toBeVisible();
    await expect(page.getByText('Se renueva a las 00:00')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reintentar/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('una verificación fallida reintenta con la misma Idempotency-Key (C11)', async ({
    page,
  }) => {
    const api = await prepare(page);
    let first = true;
    api.use((route, url) => {
      if (!(url.pathname.endsWith('/reports') && route.request().method() === 'POST' && first))
        return false;
      first = false;
      return apiError(route, 403, 'TURNSTILE_FAILED').then(() => true);
    });
    await toStep3(page);
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(
      page.getByRole('heading', { name: 'No pudimos verificar que sos una persona' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
    await expect(page.getByRole('status')).toHaveText('¡Listo, tu precio ya está publicado!');
    const [a, b] = reportPosts(api);
    expect(a!.headers['idempotency-key']).toBe(b!.headers['idempotency-key']);
  });

  test('sin respuesta guarda el borrador y reintenta con la misma clave (C12)', async ({
    page,
  }) => {
    const api = await prepare(page);
    let failures = 2;
    api.use((route, url) => {
      if (!(
        url.pathname.endsWith('/reports') &&
        route.request().method() === 'POST' &&
        failures > 0
      ))
        return false;
      failures -= 1;
      return (
        failures === 1 ? route.abort('connectionfailed') : apiError(route, 503, 'INTERNAL')
      ).then(() => true);
    });
    await toStep3(page);
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(
      page.getByText(/Se cortó la conexión. Guardamos tu carga en este dispositivo/),
    ).toBeVisible();
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('indice.draft.v1')!));
    expect(draft).toMatchObject({ priceText: '9.200', presentation: 'cajon', cajonKg: '2' });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Revisá y publicá' })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(page.getByText(/Tuvimos un problema de nuestro lado \(E-503\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Reintentar publicar' }).click();
    await expect(page.getByRole('status')).toHaveText('¡Listo, tu precio ya está publicado!');
    const keys = new Set(reportPosts(api).map((c) => c.headers['idempotency-key']));
    expect(reportPosts(api)).toHaveLength(3);
    expect(keys.size).toBe(1);
  });

  test('PRICE_OUT_OF_RANGE del servidor vuelve al paso 2 con el aviso (C4)', async ({ page }) => {
    const api = await prepare(page);
    api.use(
      (route, url) =>
        url.pathname.endsWith('/reports') &&
        route.request().method() === 'POST' &&
        apiError(route, 422, 'PRICE_OUT_OF_RANGE', {
          details: { plausibleMin: 5000, plausibleMax: 20000, pricePerKg: 4600 },
        }).then(() => true),
    );
    await toStep3(page);
    await page.getByRole('button', { name: 'Publicar precio' }).click();
    await expect(page.getByText(/Es mucho menos que lo habitual en tu zona/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Corregir el precio' })).toBeVisible();
  });
});
