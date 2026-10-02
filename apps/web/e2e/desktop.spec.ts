import { expect, prepare, test } from './fixtures';

test('Explorar en escritorio muestra índice, ofertas y mapa lado a lado (D1)', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Índice de Tres de Febrero' });
  await expect(card).toBeVisible();
  const pin = page.getByRole('button', { name: 'Frutería La Esquina: $4.400 por kg' });
  await expect(pin).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const mapBox = (await page.locator('.leaflet-container').boundingBox())!;
  expect(mapBox.x).toBeGreaterThan(cardBox.x + cardBox.width);
  await pin.click();
  await expect(page.getByRole('region', { name: 'Oferta de Frutería La Esquina' })).toBeVisible();
});

test('elegir ubicación en escritorio (D2)', async ({ page }) => {
  await prepare(page, { location: null });
  await page.goto('/ubicacion');
  await page.getByLabel('Provincia').selectOption('06');
  await page.getByRole('button', { name: 'Ver precios' }).click();
  await expect(page.getByRole('link', { name: /Ubicación: Buenos Aires/ })).toBeVisible();
});

test('cargar en escritorio sigue los mismos tres pasos (D4–D6)', async ({ page }) => {
  await prepare(page);
  await page.goto('/cargar');
  await page.getByRole('radio', { name: /Frutería La Esquina/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Precio del cartel').fill('2300');
  await page.getByRole('button', { name: '500 g' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Publicar precio' }).click();
  await expect(page.getByRole('status')).toHaveText('¡Listo, tu precio ya está publicado!');
});
