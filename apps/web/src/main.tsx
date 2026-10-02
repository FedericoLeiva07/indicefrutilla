import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { LocationProvider } from './lib/location-context';
import { createQueryClient, persistOptions } from './lib/query-client';
import './index.css';

const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <LocationProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LocationProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
