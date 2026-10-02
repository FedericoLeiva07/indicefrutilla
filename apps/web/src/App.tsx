import { Navigate, Outlet, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { DraftProvider } from './lib/draft-context';
import { LoadConfirmPage } from './pages/load/LoadConfirmPage';
import { LoadDonePage } from './pages/load/LoadDonePage';
import { LoadPricePage } from './pages/load/LoadPricePage';
import { LoadStorePage } from './pages/load/LoadStorePage';
import { NewStorePage } from './pages/load/NewStorePage';
import { LocationPage } from './pages/LocationPage';
import { MapPage } from './pages/MapPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ubicacion" element={<LocationPage />} />
      <Route path="/ofertas" element={<ListPage />} />
      <Route path="/mapa" element={<MapPage />} />
      <Route path="/cargar" element={<LoadFlow />}>
        <Route index element={<LoadStorePage />} />
        <Route path="comercio-nuevo" element={<NewStorePage />} />
        <Route path="precio" element={<LoadPricePage />} />
        <Route path="confirmar" element={<LoadConfirmPage />} />
        <Route path="listo" element={<LoadDonePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoadFlow() {
  return (
    <DraftProvider>
      <Outlet />
    </DraftProvider>
  );
}
