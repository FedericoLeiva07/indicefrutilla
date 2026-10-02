import { type Page, type Route, test as base } from '@playwright/test';

export const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date());

function monday(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export const WEEK = monday(TODAY);

export const CASEROS_LOCATION = {
  kind: 'point',
  source: 'zone',
  lat: -34.607,
  lng: -58.564,
  radius: 3000,
  provinceId: '06',
  departmentId: '06840',
  label: 'Caseros',
};

const level = (overrides: Record<string, unknown> = {}) => ({
  level: 'department',
  id: '06840',
  name: 'Tres de Febrero',
  published: true,
  medianPpk: 5200,
  p25Ppk: 4400,
  p75Ppk: 6100,
  sampleSize: 38,
  storeCount: 12,
  weeklyChangePct: -6,
  ...overrides,
});

export const REFERENCE = {
  date: TODAY,
  modalPpk: 4200,
  plausibleMin: 2940,
  plausibleMax: 16800,
  source: 'Mercado Central de Buenos Aires',
};

export function summary(overrides: Record<string, unknown> = {}) {
  return {
    weekStart: WEEK,
    levels: [
      level(),
      level({ level: 'province', id: '06', name: 'Buenos Aires', medianPpk: 5300 }),
      level({ level: 'country', id: 'AR', name: 'Argentina', medianPpk: 5250 }),
    ],
    shown: level(),
    history: Array.from({ length: 8 }, (_, i) => ({
      weekStart: `2026-08-${10 + i}`,
      medianPpk: 5000 + i * 40,
    })),
    reference: REFERENCE,
    ...overrides,
  };
}

export const unpublishedSummary = () => {
  const province = level({ level: 'province', id: '06', name: 'Buenos Aires', medianPpk: 5300 });
  return summary({
    levels: [
      level({
        published: false,
        medianPpk: null,
        p25Ppk: null,
        p75Ppk: null,
        sampleSize: 2,
        storeCount: 1,
        weeklyChangePct: null,
      }),
      province,
    ],
    shown: province,
  });
};

export function report(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    store: {
      id: 100 + id,
      name: ['Frutería La Esquina', 'Verdulería Don Tito', 'Mercado Caseros', 'Frutas del Oeste'][
        id % 4
      ],
      address: 'Av. San Martín 2850',
      location: { lat: -34.607 + id * 0.002, lng: -58.564 + id * 0.002 },
    },
    priceArs: 1100 + id * 50,
    presentation: 'g250',
    quantityG: 250,
    pricePerKg: 4400 + id * 200,
    quality: 'primera',
    observedAt: TODAY,
    createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    reporterName: null,
    distanceM: 300 + id * 150,
    votes: { up: 12, down: 0 },
    myVote: null,
    ...overrides,
  };
}

export const STORES = [
  {
    id: 201,
    name: 'Verdulería Don Tito',
    address: 'Av. Urquiza 4120',
    location: { lat: -34.606, lng: -58.563 },
    provinceId: '06',
    departmentId: '06840',
    distanceM: 350,
    reportCount: 14,
  },
  {
    id: 202,
    name: 'Frutería La Esquina',
    address: 'Av. San Martín 2850',
    location: { lat: -34.605, lng: -58.562 },
    provinceId: '06',
    departmentId: '06840',
    distanceM: 450,
    reportCount: 3,
  },
];

export type Handler = (route: Route, url: URL, body: unknown) => Promise<boolean> | boolean;

export interface ApiMock {
  calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }>;
  use: (handler: Handler) => void;
}

export function json(
  route: Route,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers,
  });
}

export function apiError(
  route: Route,
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
) {
  const headers: Record<string, string> =
    typeof extra.retryAfterSeconds === 'number'
      ? { 'Retry-After': String(extra.retryAfterSeconds) }
      : {};
  return json(route, status, { error: { code, message: code, ...extra } }, headers);
}

async function defaults(route: Route, url: URL, method: string): Promise<void> {
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/geo/provinces') {
    return json(route, 200, [
      { id: '06', name: 'Buenos Aires', centroid: { lat: -36.6, lng: -60.5 } },
      { id: '14', name: 'Córdoba', centroid: { lat: -32.1, lng: -63.8 } },
    ]);
  }
  if (path === '/geo/provinces/06/departments') {
    return json(route, 200, [
      {
        id: '06840',
        provinceId: '06',
        name: 'Tres de Febrero',
        category: 'Partido',
        centroid: { lat: -34.6, lng: -58.57 },
      },
    ]);
  }
  if (path === '/geo/departments/06840/localities') {
    return json(route, 200, [
      {
        id: '0684001001',
        provinceId: '06',
        departmentId: '06840',
        name: 'Caseros',
        centroid: { lat: -34.6066, lng: -58.5634 },
      },
    ]);
  }
  if (path === '/geo/resolve') {
    return json(route, 200, {
      province: { id: '06', name: 'Buenos Aires' },
      department: { id: '06840', name: 'Tres de Febrero' },
    });
  }
  if (path === '/index/summary') return json(route, 200, summary());
  if (path === '/reference/latest') return json(route, 200, REFERENCE);
  if (path === '/reports' && method === 'GET') {
    const cursor = Number(url.searchParams.get('cursor') ?? 0);
    const items = Array.from({ length: Math.min(20, 25 - cursor) }, (_, i) => report(cursor + i));
    return json(route, 200, {
      items,
      total: 25,
      nextCursor: cursor + items.length < 25 ? String(cursor + items.length) : null,
    });
  }
  const detail = /^\/reports\/(\d+)$/.exec(path);
  if (detail && method === 'GET') return json(route, 200, report(Number(detail[1])));
  if (path === '/stores/nearby') return json(route, 200, STORES);
  if (path === '/stores/search') return json(route, 200, []);
  if (path === '/stores' && method === 'POST') {
    return json(route, 201, {
      id: 300,
      name: 'Verdulería Pepe',
      address: 'Av. Urquiza 4400',
      location: { lat: -34.607, lng: -58.564 },
      provinceId: '06',
      departmentId: '06840',
    });
  }
  if (path === '/reports' && method === 'POST') {
    return json(route, 201, {
      report: { id: 999, pricePerKg: 4600 },
      zone: { level: 'department', id: '06840', name: 'Tres de Febrero' },
      comparison: { zoneMedian: 5200, diffPct: -12 },
    });
  }
  if (/^\/reports\/\d+\/votes$/.test(path))
    return json(route, 201, { votes: { up: 13, down: 0 }, myVote: 1, active: true });
  if (/^\/reports\/\d+\/flags$/.test(path)) return json(route, 201, { hidden: false });
  if (path === '/index/provinces') {
    return json(route, 200, {
      weeks: Number(url.searchParams.get('weeks') ?? 1),
      from: WEEK,
      to: WEEK,
      country: {
        published: true,
        medianPpk: 5200,
        p25Ppk: 4500,
        p75Ppk: 6000,
        sampleSize: 2233,
        storeCount: 400,
        weeklyChangePct: -4,
      },
      provinces: [
        {
          provinceId: '90',
          name: 'Tucumán',
          published: true,
          medianPpk: 4100,
          p25Ppk: 3800,
          p75Ppk: 4600,
          sampleSize: 97,
          storeCount: 20,
          weeklyChangePct: -8,
        },
        {
          provinceId: '06',
          name: 'Buenos Aires',
          published: true,
          medianPpk: 5200,
          p25Ppk: 4400,
          p75Ppk: 6100,
          sampleSize: 958,
          storeCount: 150,
          weeklyChangePct: -6,
        },
        {
          provinceId: '26',
          name: 'Chubut',
          published: false,
          medianPpk: null,
          p25Ppk: null,
          p75Ppk: null,
          sampleSize: 3,
          storeCount: 1,
          weeklyChangePct: null,
        },
      ],
    });
  }
  return json(route, 404, { error: { code: 'NOT_FOUND', message: `sin mock: ${method} ${path}` } });
}

const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axj1gAAAABJRU5ErkJggg==',
  'base64',
);

const FAKE_TURNSTILE = `
window.__turnstileMode = window.__turnstileMode || 'ok';
window.turnstile = {
  render(el, opts) { window.__turnstileOpts = opts; return 'w1'; },
  reset() {},
  execute() {
    const o = window.__turnstileOpts;
    setTimeout(() => window.__turnstileMode === 'error' ? o['error-callback']() : o.callback('token-' + Math.random()), 10);
  },
};`;

export async function prepare(
  page: Page,
  options: { location?: unknown; storage?: Record<string, unknown> } = {},
): Promise<ApiMock> {
  const handlers: Handler[] = [];
  const mock: ApiMock = { calls: [], use: (h) => handlers.unshift(h) };

  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG }),
  );
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.route('https://challenges.cloudflare.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_TURNSTILE }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    mock.calls.push({
      method: request.method(),
      path: url.pathname.replace('/api/v1', ''),
      body,
      headers: request.headers(),
    });
    for (const handler of handlers) {
      if (await handler(route, url, body)) return;
    }
    await defaults(route, url, request.method());
  });

  const storage: Record<string, unknown> = { ...(options.storage ?? {}) };
  if (options.location !== null)
    storage['indice.location.v1'] = options.location ?? CASEROS_LOCATION;
  await page.addInitScript((entries: Record<string, unknown>) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify(v));
  }, storage);
  return mock;
}

export function pathIs(path: string, method = 'GET'): (url: URL, route: Route) => boolean {
  return (url, route) => url.pathname === `/api/v1${path}` && route.request().method() === method;
}

export const test = base;
export { expect } from '@playwright/test';
