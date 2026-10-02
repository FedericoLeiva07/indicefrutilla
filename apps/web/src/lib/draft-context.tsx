import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { clearDraft, type Draft, loadDraft, newDraft, saveDraft } from './draft';

interface DraftState {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  reset: () => void;
  finish: () => void;
}

const DraftContext = createContext<DraftState | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? newDraft());

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = newDraft();
    saveDraft(next);
    setDraft(next);
  }, []);

  const finish = useCallback(() => {
    clearDraft();
    setDraft(newDraft());
  }, []);

  const value = useMemo(() => ({ draft, update, reset, finish }), [draft, update, reset, finish]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftState {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft fuera de DraftProvider');
  return ctx;
}
