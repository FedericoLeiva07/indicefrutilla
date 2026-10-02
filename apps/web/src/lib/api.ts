import type { ApiErrorBody, ErrorCode } from '@indice/shared';
import axios, { AxiosError } from 'axios';
import { getDeviceId } from './device';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

api.interceptors.request.use((config) => {
  config.headers.set('X-Device-Id', getDeviceId());
  return config;
});

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    readonly status: number | null,
    message: string,
    readonly details?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }

  get displayCode(): string {
    return this.status ? `E-${this.status}` : 'E-RED';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof AxiosError) {
    const body = err.response?.data as Partial<ApiErrorBody> | undefined;
    if (err.response && body?.error) {
      const { code, message, details, retryAfterSeconds } = body.error;
      return new ApiError(code, err.response.status, message, details, retryAfterSeconds);
    }
    if (err.response) {
      return new ApiError('INTERNAL', err.response.status, 'Tuvimos un problema de nuestro lado');
    }
    return new ApiError('NETWORK', null, 'Sin conexión');
  }
  return new ApiError('INTERNAL', null, 'Tuvimos un problema de nuestro lado');
}
