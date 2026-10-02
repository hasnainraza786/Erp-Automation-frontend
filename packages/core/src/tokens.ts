import { getApiBaseUrl } from './config';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Storage backend for the refresh token. Web uses localStorage; desktop/mobile plug in secure storage. */
export interface TokenStorage {
  load(): string | null;
  save(refreshToken: string | null): void;
}

const memoryStorage = (): TokenStorage => {
  let v: string | null = null;
  return { load: () => v, save: (t) => (v = t) };
};

export const localTokenStorage: TokenStorage = {
  load: () => (typeof window === 'undefined' ? null : window.localStorage.getItem('erp.refresh')),
  save: (t) => {
    if (typeof window === 'undefined') return;
    if (t) window.localStorage.setItem('erp.refresh', t);
    else window.localStorage.removeItem('erp.refresh');
  },
};

let storage: TokenStorage = typeof window === 'undefined' ? memoryStorage() : localTokenStorage;
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(signedIn: boolean) => void>();

export function setTokenStorage(s: TokenStorage) {
  storage = s;
}

export function getAccessToken() {
  return accessToken;
}

export function hasSession() {
  return !!accessToken || !!storage.load();
}

export function setTokens(tokens: Tokens | null) {
  accessToken = tokens?.accessToken ?? null;
  storage.save(tokens?.refreshToken ?? null);
  listeners.forEach((l) => l(!!tokens));
}

export function onAuthChange(listener: (signedIn: boolean) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRefreshToken() {
  return storage.load();
}

/** Single-flight refresh: concurrent 401s share one refresh call (the server rotates refresh tokens). */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refreshToken = storage.load();
  if (!refreshToken) return Promise.resolve(null);
  refreshing = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        setTokens(null);
        return null;
      }
      const data = (await res.json()) as Tokens;
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
