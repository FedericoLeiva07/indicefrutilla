export function testDatabaseUrl(): string {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgres://indice:indice@localhost:5442/indice_test';
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL debe apuntar a una base *_test (recibido: ${url})`);
  }
  return url;
}
