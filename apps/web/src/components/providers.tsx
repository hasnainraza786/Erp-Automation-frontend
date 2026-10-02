'use client';

import { ApiError } from '@erp/api-client';
import { configureApi } from '@erp/core';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { toast, Toaster } from 'sonner';
import { AuthProvider } from './auth';

configureApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000' });

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    const details = e.problem.errors?.slice(0, 3).map((x) => `${x.path ? x.path + ': ' : ''}${x.message}`).join('\n');
    return details ? `${e.message}\n${details}` : e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (e, q) => {
            if (q.meta?.silent || (e instanceof ApiError && e.status === 401)) return;
            if (q.state.data === undefined) toast.error(errorMessage(e));
          },
        }),
        mutationCache: new MutationCache({
          onError: (e, _v, _c, m) => {
            if (!m.meta?.silent) toast.error(errorMessage(e));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: false,
            retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster richColors position="top-right" closeButton toastOptions={{ style: { whiteSpace: 'pre-line' } }} />
    </QueryClientProvider>
  );
}
