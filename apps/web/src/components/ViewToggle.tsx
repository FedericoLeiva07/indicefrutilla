import { NavLink } from 'react-router';

const item = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-10 items-center justify-center rounded-[10px] px-3.5 text-sm font-semibold no-underline ${
    isActive ? 'bg-ink text-white' : 'text-ink'
  }`;

export function ViewToggle({ className = '' }: { className?: string }) {
  return (
    <nav
      aria-label="Vista"
      className={`grid grid-cols-2 rounded-2xl border border-line bg-white p-1 ${className}`}
    >
      <NavLink to="/mapa" replace className={item}>
        Mapa
      </NavLink>
      <NavLink to="/ofertas" replace className={item}>
        Lista
      </NavLink>
    </nav>
  );
}
