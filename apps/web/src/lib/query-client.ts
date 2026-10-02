import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { PERSISTED_QUERY_ROOTS } from './queries';
import { safeStorage } from './storage';

const DAY = 86_400_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: DAY, retry: 1 },
    },
  });
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createSyncStoragePersister({ storage: safeStorage, key: 'indice.cache.v1' }),
  maxAge: DAY,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' &&
      PERSISTED_QUERY_ROOTS.includes(query.queryKey[0] as (typeof PERSISTED_QUERY_ROOTS)[number]),
  },
};
