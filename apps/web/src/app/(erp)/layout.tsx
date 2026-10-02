'use client';

import { Spinner } from '@erp/ui';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'signed-out') {
      const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      router.replace(`/login/?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'signed-in') return <FullScreenSpinner />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
            <Suspense fallback={<FullScreenSpinner />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
