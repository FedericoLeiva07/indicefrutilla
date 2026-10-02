export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  StoreNotFound: 'STORE_NOT_FOUND',
  PriceOutOfRange: 'PRICE_OUT_OF_RANGE',
  StorePossibleDuplicate: 'STORE_POSSIBLE_DUPLICATE',
  TurnstileFailed: 'TURNSTILE_FAILED',
  RateLimited: 'RATE_LIMITED',
  DailyLimitReached: 'DAILY_LIMIT_REACHED',
  AlreadyVoted: 'ALREADY_VOTED',
  AlreadyFlagged: 'ALREADY_FLAGGED',
  ReportUnavailable: 'REPORT_UNAVAILABLE',
  OutsideCoverage: 'OUTSIDE_COVERAGE',
  IdempotencyConflict: 'IDEMPOTENCY_CONFLICT',
  NotFound: 'NOT_FOUND',
  Forbidden: 'FORBIDDEN',
  Internal: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  field: string;
  code: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryAfterSeconds?: number;
    details?: unknown;
  };
}
