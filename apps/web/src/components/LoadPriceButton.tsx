import { Link } from 'react-router';
import { PlusIcon } from './Icons';

export function LoadPriceButton({
  online,
  floating = true,
}: {
  online: boolean;
  floating?: boolean;
}) {
  const position = floating ? 'fixed right-5 bottom-7 z-[1000]' : '';
  if (!online) {
    const bar = floating
      ? 'fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-ground px-5 pt-3 pb-6'
      : '';
    return (
      <div className={`${bar} flex flex-col items-center gap-1.5`}>
        <button
          type="button"
          disabled
          aria-describedby="offline-load-hint"
          className="flex h-14 w-full max-w-xl items-center justify-center gap-2 rounded-2xl border-0 bg-brand font-semibold text-white opacity-45"
        >
          <PlusIcon />
          Cargar precio
        </button>
        <span id="offline-load-hint" className="text-[13px] text-muted">
          Para cargar un precio hace falta conexión
        </span>
      </div>
    );
  }
  return (
    <Link
      to="/cargar"
      className={`${position} flex h-14 items-center gap-2 rounded-full bg-brand px-5.5 font-semibold text-white no-underline shadow-[0_6px_16px_rgba(200,29,53,0.28)] hover:bg-brand-dark`}
    >
      <PlusIcon />
      Cargar precio
    </Link>
  );
}
