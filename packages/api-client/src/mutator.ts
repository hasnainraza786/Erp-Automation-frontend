import { getAccessToken, getApiBaseUrl, refreshAccessToken, setTokens } from '@erp/core';

/** RFC 7807 problem details returned by the API. */
export interface Problem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  errors?: { path: string; message: string }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.detail || problem.title || `Request failed (${problem.status})`);
    this.status = problem.status;
    this.problem = problem;
  }
}

const IDEMPOTENT = /\/(payments|vendor-payments)$|\/quotations\/[^/]+\/approve$|\/purchase-orders\/[^/]+\/receive$/;

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function send(url: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body instanceof FormData) headers.delete('content-type');
  return fetch(url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`, { ...init, headers });
}

/**
 * Orval mutator: base URL, Bearer token, one transparent refresh on 401, Idempotency-Key for
 * money-moving POSTs (kept identical across the retry), problem+json errors, and Blob for files.
 */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.split('?')[0];
  if (method === 'POST' && IDEMPOTENT.test(path)) {
    const headers = new Headers(init.headers);
    if (!headers.has('idempotency-key')) headers.set('idempotency-key', newKey());
    init = { ...init, headers };
  }

  let res = await send(url, init, getAccessToken());
  if (res.status === 401 && !path.endsWith('/auth/login')) {
    const token = await refreshAccessToken();
    if (!token) {
      setTokens(null);
      throw new ApiError({ status: 401, title: 'Session expired', detail: 'Please sign in again.' });
    }
    res = await send(url, init, token);
  }

  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const problem: Problem = type.includes('json') ? await res.json().catch(() => ({ status: res.status })) : { status: res.status, detail: await res.text().catch(() => '') };
    throw new ApiError({ ...problem, status: res.status });
  }
  if (res.status === 204) return undefined as T;
  if (type.includes('json')) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export default apiFetch;
