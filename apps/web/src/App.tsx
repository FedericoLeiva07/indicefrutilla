import { Navigate, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { LoadPlaceholderPage } from './pages/LoadPlaceholderPage';
import { LocationPage } from './pages/LocationPage';
import { MapPage } from './pages/MapPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ubicacion" element={<LocationPage />} />
      <Route path="/ofertas" element={<ListPage />} />
      <Route path="/mapa" element={<MapPage />} />
      <Route path="/cargar" element={<LoadPlaceholderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
