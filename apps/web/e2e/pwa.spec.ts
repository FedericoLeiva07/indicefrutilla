import { expect, prepare, test } from './fixtures';

test.use({ serviceWorkers: 'allow' });

test('es instalable: manifest con íconos y service worker activo', async ({ page, request }) => {
  await prepare(page);
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: 'Índice Frutilla',
    short_name: 'Índice',
    display: 'standalone',
    start_url: '/',
    lang: 'es-AR',
  });
  const icons = manifest.icons as Array<{ sizes: string; purpose: string }>;
  expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
  expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of icons)
    expect((await request.get((icon as unknown as { src: string }).src)).ok()).toBe(true);

  await expect
    .poll(
      () => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active),
      { timeout: 15_000 },
    )
    .toBe(true);
});
