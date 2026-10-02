import { apiError, expect, json, prepare, report, test, unpublishedSummary } from './fixtures';

test.describe('Ubicación (2, E5, E6)', () => {
  test('sin ubicación guardada pide elegir una zona y la usa en Inicio', async ({ page }) => {
    await prepare(page, { location: null });
    await page.goto('/');
    await expect(page).toHaveURL(/\/ubicacion$/);
    await expect(page.getByRole('heading', { name: '¿Dónde buscamos frutillas?' })).toBeVisible();

    await page.getByLabel('Provincia').selectOption('06');
    await page.getByLabel('Partido o departamento').selectOption('06840');
    await page.getByLabel('Localidad').selectOption('0684001001');
    await page.getByRole('button', { name: '5 km' }).click();
    await page.getByRole('button', { name: 'Ver precios' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /Ubicación: Caseros/ })).toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('indice.location.v1')!),
    );
    expect(saved).toMatchObject({ departmentId: '06840', label: 'Caseros', radius: 5000 });
  });

  test('con la ubicación actual redondea a 3 decimales y resuelve la zona', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -34.60412, longitude: -58.56271 });
    const api = await prepare(page, { location: null });
    await page.goto('/ubicacion');
    await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click();
    await expect(page).toHaveURL(/\/$/);
    const resolve = api.calls.find((c) => c.path === '/geo/resolve');
    expect(resolve).toBeTruthy();
    await expect(page.getByRole('link', { name: /Ubicación: Tres de Febrero/ })).toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('indice.location.v1')!),
    );
    expect(saved).toMatchObject({ source: 'gps', lat: -34.604, lng: -58.563 });
  });

  test('permiso denegado muestra el aviso y deja elegir la zona (E5)', async ({ page }) => {
    await prepare(page, { location: null });
    await page.goto('/ubicacion');
    await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click();
    await expect(page.getByRole('alert')).toContainText('No tenemos permiso para ubicarte');
    await expect(page.getByLabel('Provincia')).toBeVisible();
  });

  test('fuera de Argentina ofrece elegir una zona o ver el país (E6)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -34.9011, longitude: -56.1645 });
    const api = await prepare(page, { location: null });
    api.use(
      (route, url) =>
        url.pathname.endsWith('/geo/resolve') &&
        apiError(route, 404, 'OUTSIDE_COVERAGE').then(() => true),
    );
    await page.goto('/ubicacion');
    await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Por ahora solo cubrimos Argentina' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ver todo el país' }).click();
    await expect(page).toHaveURL(/\/indice$/);
  });
});

test.describe('Inicio (1, E1, E2, E3, E4)', () => {
  test('muestra el índice publicado, el histórico y las ofertas cercanas (1)', async ({ page }) => {
    await prepare(page);
    await page.goto('/');
    const card = page.getByRole('region', { name: 'Índice de Tres de Febrero' });
    await expect(card).toContainText('$5.200');
    await expect(card).toContainText('▼ 6% contra la semana anterior');
    await expect(card).toContainText('Más barato 25%$4.400');
    await expect(card).toContainText('Más caro 25%$6.100');
    await expect(card).toContainText('38 ofertas');
    await expect(card.getByRole('img', { name: /últimas 8 semanas/ })).toBeVisible();
    await expect(page.getByText('Frutería La Esquina').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cargar precio' })).toBeVisible();
  });

  test('muestra el esqueleto mientras carga (E1)', async ({ page }) => {
    const api = await prepare(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    api.use(async (_route, url) => {
      if (!url.pathname.endsWith('/index/summary')) return false;
      await gate;
      return false;
    });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Cargando el índice' })).toBeVisible();
    await expect(page.getByText('Buscando precios cerca tuyo…')).toBeVisible();
    release();
    await expect(page.getByRole('region', { name: 'Índice de Tres de Febrero' })).toBeVisible();
  });

  test('sin datos en la zona muestra el conteo, el nivel publicado y las acciones (E2)', async ({
    page,
  }) => {
    const api = await prepare(page);
    api.use(
      (route, url) =>
        url.pathname.endsWith('/index/summary') &&
        json(route, 200, unpublishedSummary()).then(() => true),
    );
    api.use(
      (route, url, _b) =>
        url.pathname.endsWith('/reports') &&
        route.request().method() === 'GET' &&
        json(route, 200, { items: [], total: 0, nextCursor: null }).then(() => true),
    );
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Todavía no hay datos suficientes' }),
    ).toBeVisible();
    await expect(page.getByText(/Esta semana hay 2\./)).toBeVisible();
    await expect(page.getByText('Mientras tanto, Buenos Aires')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'No hay precios cargados a menos de 3 km' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cargar el primer precio' })).toBeVisible();

    await page.getByRole('button', { name: 'Ampliar a 10 km' }).click();
    await expect(
      page.getByRole('heading', { name: 'No hay precios cargados a menos de 10 km' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ver la provincia' }).click();
    await expect(page.getByRole('link', { name: /Ubicación: Buenos Aires/ })).toBeVisible();
  });

  test('un error del servidor muestra el código y permite reintentar (E4)', async ({ page }) => {
    const api = await prepare(page);
    let fail = true;
    api.use((route, url) => {
      if (!url.pathname.endsWith('/index/summary') || !fail) return false;
      return apiError(route, 503, 'INTERNAL').then(() => true);
    });
    await page.goto('/');
    await expect(page.getByRole('alert').first()).toContainText('No pudimos cargar los precios');
    await expect(page.getByText('E-503')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).first().click();
    await expect(page.getByRole('region', { name: 'Índice de Tres de Febrero' })).toBeVisible();
  });

  test('sin conexión muestra los datos guardados y deshabilita la carga (E3)', async ({
    page,
    context,
  }) => {
    await prepare(page);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Índice de Tres de Febrero' })).toBeVisible();
    await page.waitForFunction(() => !!localStorage.getItem('indice.cache.v1'));
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión.' })).toContainText(
      'Estás viendo los precios guardados',
    );
    await expect(page.getByRole('button', { name: 'Cargar precio' })).toBeDisabled();
    await expect(page.getByText('Para cargar un precio hace falta conexión')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Índice de Tres de Febrero' })).toContainText(
      '$5.200',
    );
    await context.setOffline(false);
  });
});

test.describe('Lista y mapa (3, 4)', () => {
  test('ordena, cuenta y pagina las ofertas (4)', async ({ page }) => {
    const api = await prepare(page);
    await page.goto('/ofertas');
    await expect(page.getByText('25 ofertas de los últimos 7 días')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(20);
    await page.getByRole('button', { name: 'Ver más ofertas' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(25);
    await page.getByRole('button', { name: 'Más cerca' }).click();
    await expect(page.getByRole('button', { name: 'Más cerca' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(api.calls.some((c) => c.path === '/reports' && c.method === 'GET')).toBe(true);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('indice.sort.v1')))
      .toBe('"distance"');
  });

  test('muestra pines con $/kg y la ficha con votos y cómo llegar (3)', async ({ page }) => {
    await prepare(page);
    await page.goto('/mapa');
    const pin = page.getByRole('button', { name: 'Frutería La Esquina: $4.400 por kg' });
    await expect(pin).toBeVisible();
    await pin.click();
    const sheet = page.getByRole('region', { name: 'Oferta de Frutería La Esquina' });
    await expect(sheet).toContainText('$4.400');
    await expect(sheet.getByRole('button', { name: 'Sigue (12)' })).toBeEnabled();
    await expect(sheet.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute(
      'href',
      /google\.com\/maps\/dir/,
    );
  });
});

test.describe('Comunidad (E7, E8, E9)', () => {
  test('votar actualiza el contador y deshabilita los botones (E7)', async ({ page }) => {
    const api = await prepare(page);
    await page.goto('/ofertas');
    await page.getByRole('listitem').first().getByRole('button').click();
    await page.getByRole('button', { name: 'Sigue (12)' }).click();
    await expect(page.getByText('Gracias, confirmaste que el precio sigue')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sigue (13)' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ya no está' })).toBeDisabled();
    await expect(page.getByText('Ya votaste esta oferta desde este dispositivo')).toBeVisible();
    const vote = api.calls.find((c) => c.path === '/reports/0/votes');
    expect(vote?.body).toEqual({ value: 1 });
    expect(vote?.headers['x-device-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('ALREADY_VOTED muestra el estado votado (E7)', async ({ page }) => {
    const api = await prepare(page);
    api.use(
      (route, url) =>
        url.pathname.endsWith('/votes') &&
        apiError(route, 409, 'ALREADY_VOTED', {
          details: { votes: { up: 12, down: 4 }, myVote: -1 },
        }).then(() => true),
    );
    await page.goto('/ofertas');
    await page.getByRole('listitem').first().getByRole('button').click();
    await page.getByRole('button', { name: 'Ya no está' }).click();
    await expect(page.getByRole('button', { name: 'Ya no está (4)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('denunciar ofrece 3 motivos y se envía una sola vez (E8)', async ({ page }) => {
    const api = await prepare(page);
    await page.goto('/ofertas');
    await page.getByRole('listitem').first().getByRole('button').click();
    await page.getByRole('button', { name: 'Denunciar esta oferta' }).click();
    const dialog = page.getByRole('dialog', { name: '¿Qué pasa con esta oferta?' });
    await expect(dialog.getByRole('radio')).toHaveCount(3);
    await dialog.getByRole('radio', { name: 'Es spam o publicidad' }).click();
    await dialog.getByRole('button', { name: 'Enviar denuncia' }).click();
    await expect(
      page.getByText(/Con 3 denuncias de dispositivos distintos, la ocultamos/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Denunciar esta oferta' })).toHaveCount(0);
    expect(api.calls.find((c) => c.path.endsWith('/flags'))?.body).toEqual({ reason: 'spam' });
  });

  test('una oferta que ya no está explica el motivo y la saca de la lista (E9)', async ({
    page,
  }) => {
    const api = await prepare(page);
    let detailRequested = false;
    api.use((route, url) => {
      if (url.pathname.endsWith('/reports/0')) {
        detailRequested = true;
        return apiError(route, 410, 'REPORT_UNAVAILABLE', { details: { reason: 'expired' } }).then(
          () => true,
        );
      }
      if (
        url.pathname.endsWith('/reports') &&
        route.request().method() === 'GET' &&
        detailRequested
      ) {
        return json(route, 200, { items: [report(1)], total: 1, nextCursor: null }).then(
          () => true,
        );
      }
      return false;
    });
    await page.goto('/ofertas');
    await expect(page.getByText('25 ofertas de los últimos 7 días')).toBeVisible();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(
      page.getByRole('heading', { name: 'Esta oferta ya no está disponible' }),
    ).toBeVisible();
    await expect(page.getByText('Venció: tiene más de 7 días')).toBeVisible();
    await expect(page.getByText('1 oferta de los últimos 7 días')).toBeVisible();
    await page.getByRole('link', { name: 'Ver otras ofertas cerca' }).click();
    await expect(page.getByRole('region', { name: 'Oferta no disponible' })).toHaveCount(0);
  });
});

test('índice nacional por provincia con ventanas (D3)', async ({ page }) => {
  const api = await prepare(page);
  await page.goto('/indice');
  await expect(page.getByRole('heading', { name: 'Índice nacional' })).toBeVisible();
  await expect(page.getByText('$5.200').first()).toBeVisible();
  const rows = page.getByRole('row');
  await expect(rows.filter({ hasText: 'Tucumán' })).toContainText('$4.100');
  await expect(rows.filter({ hasText: 'Chubut' })).toContainText('Sin datos suficientes');
  await page.getByRole('button', { name: 'Últimas 12' }).click();
  await expect.poll(() => api.calls.some((c) => c.path === '/index/provinces')).toBe(true);
  await expect(page.getByText('últimas 12 semanas')).toBeVisible();
});
