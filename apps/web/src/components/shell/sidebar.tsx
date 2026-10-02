'use client';

import { cn } from '@erp/ui';
import { Cpu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth';
import { NAV } from '@/lib/nav';

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <Link href="/" onClick={onNavigate} className="flex h-14 items-center gap-2 border-b border-white/10 px-5 text-white">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary">
          <Cpu className="size-4" />
        </span>
        <span className="font-semibold tracking-tight">Automation ERP</span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.permission));
          if (!items.length) return null;
          return (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-active hover:text-white',
                        isActive(item.href) && 'bg-sidebar-active font-medium text-white',
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <p className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'} · PKR</p>
    </aside>
  );
}
