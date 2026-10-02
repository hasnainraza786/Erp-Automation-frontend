'use client';

import {
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
  useGetUnreadNotificationCount,
  useGlobalSearch,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
} from '@erp/api-client';
import { relativeTime } from '@erp/core';
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Spinner,
} from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, KeyRound, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth';
import { useDebounced } from '@/lib/hooks';
import { entityHref } from '@/lib/nav';
import { ChangePasswordDialog } from './change-password';

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(q.trim(), 250);
  const { data, isFetching } = useGlobalSearch({ q: debounced }, { query: { enabled: debounced.length >= 2, meta: { silent: true } } });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Popover open={open && debounced.length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={ref}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search clients, projects, quotations, payments…"
            className="h-9 w-full rounded-md border border-input bg-muted/50 pl-8 pr-14 text-sm outline-none focus:border-ring focus:bg-background"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:block">Ctrl K</kbd>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-80 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {isFetching && !data ? (
          <div className="flex justify-center p-4">
            <Spinner />
          </div>
        ) : !data?.length ? (
          <p className="p-3 text-sm text-muted-foreground">No results for “{debounced}”</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {data.map((r) => (
              <li key={`${r.type}-${r.id}`}>
                <button
                  className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    const href = entityHref(r.type, r.id);
                    if (href) router.push(href);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  <Badge className="w-24 justify-center">{r.type.replace('_', ' ').toLowerCase()}</Badge>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: count } = useGetUnreadNotificationCount({ query: { refetchInterval: 60_000, meta: { silent: true } } });
  const { data } = useListNotifications({ pageSize: 15 }, { query: { enabled: open } });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };
  const markRead = useMarkNotificationsRead({ mutation: { onSuccess: invalidate } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSuccess: invalidate } });
  const unread = count?.unreadCount ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="link" size="sm" disabled={!unread} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto p-1">
          {!data ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : !data.data.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            data.data.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn('flex-col items-start gap-0.5', !n.readAt && 'bg-primary/5')}
                onSelect={() => {
                  if (!n.readAt) markRead.mutate({ data: { ids: [n.id] } });
                  const href = entityHref(n.entityType, n.entityId);
                  if (href) router.push(href);
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem('erp.theme') === 'dark';
    setDark(d);
    document.documentElement.classList.toggle('dark', d);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => {
        const d = !dark;
        setDark(d);
        localStorage.setItem('erp.theme', d ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', d);
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const initials = user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials}</span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-sm font-medium">{user?.name}</span>
                <span className="block text-xs text-muted-foreground">{user?.role}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPwOpen(true)}>
              <KeyRound /> Change password
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => logout()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </header>
  );
}
