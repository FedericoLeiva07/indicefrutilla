import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { ErrorCode, type FieldError } from '@indice/shared';
import { AppException } from './app-exception';

export function toFieldErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, code: Object.keys(e.constraints)[0] ?? 'invalid' }] : [];
    return [...own, ...toFieldErrors(e.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        ErrorCode.ValidationFailed,
        400,
        'Hay datos inválidos en la solicitud',
        toFieldErrors(errors),
      ),
  });
}
