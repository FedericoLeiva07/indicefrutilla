import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { draftFromReport, type ReportPrefill } from '../../lib/draft';
import { useDraft } from '../../lib/draft-context';

export function EditPricePage() {
  const prefill = (useLocation().state as { report?: ReportPrefill } | null)?.report;
  const { replace } = useDraft();
  const navigate = useNavigate();

  useEffect(() => {
    if (!prefill) return;
    replace(draftFromReport(prefill));
    void navigate('/cargar/precio', { replace: true });
  }, [prefill, replace, navigate]);

  if (!prefill) return <Navigate to="/cargar" replace />;
  return null;
}
