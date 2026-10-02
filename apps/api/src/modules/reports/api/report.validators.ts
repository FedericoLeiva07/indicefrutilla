import {
  argentinaDate,
  isIsoDate,
  OBSERVED_AT_MAX_DAYS_AGO,
  type Presentation,
  QUANTITY_LIMITS_G,
  shiftDate,
} from '@indice/shared';
import { registerDecorator, type ValidationArguments } from 'class-validator';

export function needsQuantity(presentation: unknown): presentation is 'cajon' | 'otro' {
  return presentation === 'cajon' || presentation === 'otro';
}

export function Required(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'required',
      target: target.constructor,
      propertyName: String(propertyName),
      validator: { validate: (value: unknown) => value !== undefined && value !== null },
    });
}

export function QuantityInRange(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'range',
      target: target.constructor,
      propertyName: String(propertyName),
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'number' || !Number.isInteger(value)) return false;
          const presentation = (args.object as { presentation?: Presentation }).presentation;
          if (!needsQuantity(presentation)) return true;
          const { min, max } = QUANTITY_LIMITS_G[presentation];
          return value >= min && value <= max;
        },
      },
    });
}

export function isRecentObservedAt(value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== 'string' || !isIsoDate(value)) return false;
  const today = argentinaDate(now);
  return value <= today && value >= shiftDate(today, -OBSERVED_AT_MAX_DAYS_AGO);
}

export function RecentObservedAt(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'recentDate',
      target: target.constructor,
      propertyName: String(propertyName),
      validator: { validate: (value: unknown) => isRecentObservedAt(value) },
    });
}
