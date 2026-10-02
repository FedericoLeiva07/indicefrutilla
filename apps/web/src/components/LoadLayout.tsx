import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeftIcon } from './Icons';

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function LoadLayout({
  step,
  title,
  back,
  footer,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  back: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-5 pt-3 pb-7">
      <div className="flex items-center justify-between">
        {back ? (
          <Link
            to={back}
            aria-label="Volver"
            className="-ml-2.5 flex size-11 items-center justify-center text-ink"
          >
            <ChevronLeftIcon size={22} />
          </Link>
        ) : (
          <Link
            to="/"
            aria-label="Cerrar"
            className="-ml-2.5 flex size-11 items-center justify-center text-ink"
          >
            <CloseIcon />
          </Link>
        )}
        <div className="text-[13px] text-muted">Paso {step} de 3</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1 rounded-sm ${n <= step ? 'bg-brand' : 'bg-line'}`} />
        ))}
      </div>
      <h1 className="m-0 font-display text-[28px] font-extrabold tracking-tight">{title}</h1>
      {children}
      {footer && (
        <>
          <div className="flex-1" />
          {footer}
        </>
      )}
    </main>
  );
}

export function PrimaryButton({
  children,
  disabled,
  busy,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className="flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-0 bg-brand text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {busy && (
        <span
          className="size-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function Notice({
  tone,
  role = 'status',
  children,
}: {
  tone: 'warn' | 'danger';
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  const styles =
    tone === 'warn'
      ? 'border-warn-line bg-warn-soft text-warn'
      : 'border-danger-line bg-danger-soft text-danger';
  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm leading-snug ${styles}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17.5v.01" />
      </svg>
      <div>{children}</div>
    </div>
  );
}
