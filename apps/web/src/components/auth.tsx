'use client';

import { getMe, login as apiLogin, logout as apiLogout, type MeDtoOutput } from '@erp/api-client';
import { can, getRefreshToken, hasSession, onAuthChange, refreshAccessToken, setTokens, type Permission } from '@erp/core';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Status = 'loading' | 'signed-in' | 'signed-out';

interface AuthState {
  status: Status;
  user: MeDtoOutput | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p?: Permission | Permission[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<MeDtoOutput | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setUser(await getMe());
      setStatus('signed-in');
    } catch {
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!hasSession()) return setStatus('signed-out');
      const token = await refreshAccessToken();
      if (!token) return setStatus('signed-out');
      await loadMe();
    })();
    return onAuthChange((signedIn) => {
      if (!signedIn) {
        setUser(null);
        setStatus('signed-out');
        qc.clear();
      }
    }) as () => void;
  }, [loadMe, qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin({ email, password });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      setStatus('signed-in');
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) await apiLogout({ refreshToken }).catch(() => undefined);
    setTokens(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, can: (p) => can(user?.permissions, p) }),
    [status, user, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function Can({ permission, children, fallback = null }: { permission?: Permission | Permission[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useAuth().can(permission) ? <>{children}</> : <>{fallback}</>;
}
