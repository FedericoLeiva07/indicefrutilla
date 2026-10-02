import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeftIcon } from './Icons';
import { Logo } from './Logo';

const backClass = 'flex size-11 shrink-0 items-center justify-center rounded-full text-ink';

function hasInAppHistory() {
  const state: unknown = window.history.state;
  return (
    typeof state === 'object' &&
    state !== null &&
    'idx' in state &&
    typeof state.idx === 'number' &&
    state.idx > 0
  );
}

export function BackButton({
  fallback = '/',
  className = '',
}: {
  fallback?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  if (hasInAppHistory()) {
    return (
      <button
        type="button"
        aria-label="Volver"
        onClick={() => void navigate(-1)}
        className={`${backClass} cursor-pointer border-0 bg-transparent ${className}`}
      >
        <ChevronLeftIcon size={22} />
      </button>
    );
  }

  return (
    <Link to={fallback} aria-label="Volver" className={`${backClass} ${className}`}>
      <ChevronLeftIcon size={22} />
    </Link>
  );
}

export function PageHeader({
  floating = false,
  children,
}: {
  floating?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div
        className={`flex items-center gap-1 ${
          floating
            ? 'rounded-2xl bg-white py-1 pr-3.5 pl-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
            : '-ml-2.5'
        }`}
      >
        <BackButton />
        <Logo />
      </div>
      {children}
    </header>
  );
}
