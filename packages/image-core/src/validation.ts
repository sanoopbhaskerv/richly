import type { ValidationResult } from './types';

/** Successful validation singleton used to avoid throw-based control flow. */
export const valid: ValidationResult = { ok: true };

/** Creates a typed validation failure for command and restore paths. */
export function invalid(code: string, message: string): ValidationResult {
  return { ok: false, code, message };
}

/** True when a value is a finite number. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Returns a positive finite number or `null` when validation should fail. */
export function positiveNumber(value: unknown): number | null {
  return isFiniteNumber(value) && value > 0 ? value : null;
}
