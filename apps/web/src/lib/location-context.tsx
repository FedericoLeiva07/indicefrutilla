import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { loadLocation, type SavedLocation, saveLocation } from './location';

interface LocationState {
  location: SavedLocation | null;
  setLocation: (location: SavedLocation) => void;
}

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setState] = useState<SavedLocation | null>(() => loadLocation());
  const setLocation = useCallback((next: SavedLocation) => {
    saveLocation(next);
    setState(next);
  }, []);
  const value = useMemo(() => ({ location, setLocation }), [location, setLocation]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): LocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useUserLocation fuera de LocationProvider');
  return ctx;
}
