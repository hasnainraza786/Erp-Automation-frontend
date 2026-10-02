'use client';

import { listClients, listProducts, listProjects, listSites, listVendors, searchProducts, type ProductSearchResultDtoOutputItem as ProductHit } from '@erp/api-client';
import { pkr } from '@erp/core';
import { cn, Popover, PopoverAnchor, PopoverContent, Spinner } from '@erp/ui';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useDebounced } from '@/lib/hooks';

export interface Option {
  id: string;
  label: string;
  sub?: string | null;
}

export function AsyncPicker({
  value,
  label,
  onChange,
  load,
  queryKey,
  placeholder = 'Select…',
  disabled,
  clearable,
  className,
}: {
  value: string | null | undefined;
  label?: string | null;
  onChange: (opt: Option | null) => void;
  load: (q: string) => Promise<Option[]>;
  queryKey: unknown[];
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 200);
  const { data, isFetching } = useQuery({ queryKey: [...queryKey, debounced], queryFn: () => load(debounced), enabled: open, staleTime: 30_000 });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? label || 'Selected' : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {clearable && value && (
              <X
                className="size-3.5 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="size-3.5" />
          </span>
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="h-9 w-full border-b border-border bg-transparent px-3 text-sm outline-none" />
        <ul className="max-h-72 overflow-y-auto p-1">
          {isFetching && !data && (
            <li className="flex justify-center p-3">
              <Spinner className="size-4" />
            </li>
          )}
          {data?.length === 0 && <li className="p-3 text-sm text-muted-foreground">No matches</li>}
          {data?.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                  setQ('');
                }}
              >
                <Check className={cn('mt-0.5 size-3.5 shrink-0', o.id === value ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{o.label}</span>
                  {o.sub && <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type PickerProps = Omit<Parameters<typeof AsyncPicker>[0], 'load' | 'queryKey'>;

export function ClientPicker(props: PickerProps) {
  return (
    <AsyncPicker
      placeholder="Select client"
      queryKey={['pick', 'clients']}
      load={async (q) => (await listClients({ q: q || undefined, pageSize: 20, status: 'ACTIVE' })).data.map((c) => ({ id: c.id, label: c.name, sub: [c.code, c.phone].filter(Boolean).join(' · ') }))}
      {...props}
    />
  );
}

export function SitePicker({ clientId, ...props }: PickerProps & { clientId?: string | null }) {
  return (
    <AsyncPicker
      placeholder={clientId ? 'Select site' : 'Select a client first'}
      disabled={props.disabled || !clientId}
      queryKey={['pick', 'sites', clientId]}
      load={async (q) => (await listSites({ clientId: clientId ?? undefined, q: q || undefined, pageSize: 50 })).data.map((s) => ({ id: s.id, label: s.name, sub: s.address }))}
      {...props}
    />
  );
}

export function VendorPicker(props: PickerProps) {
  return (
    <AsyncPicker
      placeholder="Select vendor"
      queryKey={['pick', 'vendors']}
      load={async (q) => (await listVendors({ q: q || undefined, pageSize: 20 })).data.map((v) => ({ id: v.id, label: v.name, sub: v.code }))}
      {...props}
    />
  );
}

export function ProjectPicker({ clientId, ...props }: PickerProps & { clientId?: string | null }) {
  return (
    <AsyncPicker
      placeholder="Select project"
      queryKey={['pick', 'projects', clientId]}
      load={async (q) => (await listProjects({ clientId: clientId ?? undefined, q: q || undefined, pageSize: 20 })).data.map((p) => ({ id: p.id, label: `${p.number} · ${p.name}`, sub: p.client.name }))}
      {...props}
    />
  );
}

export type ProductOption = Option & { product: ProductHit };

export function ProductPicker({ onPick, ...props }: Omit<PickerProps, 'onChange'> & { onPick: (p: ProductHit) => void }) {
  const [cache] = useState(() => new Map<string, ProductHit>());
  return (
    <AsyncPicker
      placeholder="Add product…"
      queryKey={['pick', 'products']}
      load={async (q) =>
        (q.trim()
          ? await searchProducts({ q: q.trim(), limit: 30 })
          : (await listProducts({ pageSize: 30, active: 'true' })).data.map((p) => ({ id: p.id, sku: p.sku, name: p.name, brand: p.brand, unit: p.unit, sellingPrice: p.sellingPrice, minPrice: p.minPrice, taxRate: p.taxRate, available: p.stock.available }))
        ).map((p) => {
          cache.set(p.id, p);
          return { id: p.id, label: `${p.name}`, sub: `${p.sku} · ${pkr(p.sellingPrice)} · avail ${Number(p.available)}` };
        })
      }
      onChange={(o) => o && cache.get(o.id) && onPick(cache.get(o.id)!)}
      {...props}
    />
  );
}
