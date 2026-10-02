const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const DEV_TEST_SITE_KEY = '1x00000000000000000000AA';
const TOKEN_TIMEOUT_MS = 30_000;

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export class TurnstileUnavailableError extends Error {}

let scriptPromise: Promise<TurnstileApi> | null = null;
interface WidgetState {
  id: string;
  pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null;
}

let widget: WidgetState | null = null;

export function turnstileSiteKey(): string {
  const configured = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  if (configured) return configured;
  if (import.meta.env.DEV) return DEV_TEST_SITE_KEY;
  throw new TurnstileUnavailableError('Falta VITE_TURNSTILE_SITE_KEY');
}

function loadScript(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new TurnstileUnavailableError('Turnstile no cargó'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new TurnstileUnavailableError('No se pudo cargar Turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function container(): HTMLElement {
  let el = document.getElementById('turnstile-widget');
  if (!el) {
    el = document.createElement('div');
    el.id = 'turnstile-widget';
    el.className = 'fixed bottom-4 left-1/2 z-[2000] -translate-x-1/2';
    document.body.appendChild(el);
  }
  return el;
}

export async function getTurnstileToken(): Promise<string> {
  const api = await loadScript();
  if (!widget) {
    const state: WidgetState = { id: '', pending: null };
    state.id = api.render(container(), {
      sitekey: turnstileSiteKey(),
      execution: 'execute',
      appearance: 'interaction-only',
      language: 'es',
      callback: (token: string) => {
        state.pending?.resolve(token);
        state.pending = null;
      },
      'error-callback': () => {
        state.pending?.reject(new TurnstileUnavailableError('Falló la verificación'));
        state.pending = null;
      },
      'expired-callback': () => undefined,
    });
    widget = state;
  }
  const current = widget;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      current.pending = null;
      reject(new TurnstileUnavailableError('La verificación tardó demasiado'));
    }, TOKEN_TIMEOUT_MS);
    current.pending = {
      resolve: (t) => {
        clearTimeout(timer);
        resolve(t);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    };
    api.reset(current.id);
    api.execute(current.id);
  });
}
