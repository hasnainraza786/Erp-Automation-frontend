'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Detail pages use `?id=` because the static export cannot pre-render dynamic segments. */
export function useIdParam() {
  return useSearchParams().get('id') ?? '';
}

/** Keeps list filters in the URL so they survive reloads and can be shared. */
export function useQueryState<T extends Record<string, string | number | undefined>>(defaults: T) {
  const router = useRouter();
  const params = useSearchParams();
  const state = { ...defaults } as T;
  for (const k of Object.keys(defaults)) {
    const v = params.get(k);
    if (v !== null) (state as Record<string, unknown>)[k] = typeof defaults[k] === 'number' ? Number(v) : v;
  }
  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
        else next.set(k, String(v));
      }
      if (!('page' in patch) && 'page' in defaults) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, router],
  );
  return [state, set] as const;
}
