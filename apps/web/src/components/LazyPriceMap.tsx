import { type ComponentProps, lazy, Suspense } from 'react';

const PriceMap = lazy(() => import('./PriceMap').then((m) => ({ default: m.PriceMap })));

export function LazyPriceMap(props: ComponentProps<typeof PriceMap>) {
  return (
    <Suspense
      fallback={
        <div className={`${props.className ?? ''} bg-[#E7EAE2]`} aria-label="Cargando el mapa" />
      }
    >
      <PriceMap {...props} />
    </Suspense>
  );
}
