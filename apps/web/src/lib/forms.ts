import { ApiError } from '@erp/api-client';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** Maps RFC 7807 validation issues onto form fields; returns true when at least one field matched. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fields: string[]) {
  if (!(e instanceof ApiError) || !e.problem.errors?.length) return false;
  let matched = false;
  for (const err of e.problem.errors) {
    const key = err.path.split('.')[0];
    if (fields.includes(key)) {
      setError(key as Path<T>, { message: err.message });
      matched = true;
    }
  }
  return matched;
}

/** Empty strings become null (clears optional fields on update) or are dropped (on create). */
export function clean<T extends Record<string, unknown>>(values: T, mode: 'create' | 'update' = 'create'): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === '' || v === undefined) {
      if (mode === 'update') out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

export const CLIENT_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'BUILDER', 'CONTRACTOR', 'CORPORATE', 'OTHER'] as const;
export const SITE_TYPES = ['HOUSE', 'APARTMENT', 'VILLA', 'OFFICE', 'HOTEL', 'RESTAURANT', 'COMMERCIAL', 'OTHER'] as const;
export const SITE_STATUSES = ['LEAD', 'QUOTATION', 'APPROVED', 'PROCUREMENT', 'INSTALLATION', 'TESTING', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
export const UNITS = ['PIECE', 'SET', 'METER', 'FEET', 'BOX', 'PAIR', 'HOUR', 'LOT', 'OTHER'] as const;
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_TRANSFER', 'OTHER'] as const;
export const EXPENSE_CATEGORIES = ['TRANSPORT', 'INSTALLATION_LABOR', 'PROGRAMMING', 'SALARIES', 'OFFICE', 'OTHER'] as const;
export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'UNDER_DISCUSSION', 'REVISED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const;
export const PROJECT_STATUSES = ['APPROVED', 'PROCUREMENT', 'INSTALLATION', 'TESTING', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
