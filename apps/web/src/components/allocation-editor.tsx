'use client';

import type { OpenItemsDtoOutput } from '@erp/api-client';
import { pkr } from '@erp/core';
import { Button, Input, Select, Table, TBody, TD, TH, THead, TR, cn } from '@erp/ui';
import { Wand2 } from 'lucide-react';
import { Money } from '@/components/page';

export type AllocationDraft = Record<string, { amount: string; invoiceId: string }>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function allocationsFrom(draft: AllocationDraft) {
  return Object.entries(draft)
    .filter(([, a]) => Number(a.amount) > 0)
    .map(([projectId, a]) => ({ projectId, invoiceId: a.invoiceId || null, amount: a.amount }));
}

export function allocatedTotal(draft: AllocationDraft) {
  return round2(Object.values(draft).reduce((s, a) => s + (Number(a.amount) || 0), 0));
}

/** Split an amount across a client's projects (optionally against a specific invoice). */
export function AllocationEditor({ items, available, value, onChange }: { items: OpenItemsDtoOutput | undefined; available: number; value: AllocationDraft; onChange: (v: AllocationDraft) => void }) {
  const projects = items?.projects ?? [];
  const allocated = allocatedTotal(value);
  const remaining = round2(available - allocated);

  const autoFill = () => {
    let left = available;
    const next: AllocationDraft = {};
    for (const p of projects) {
      const take = Math.min(left, Number(p.balance));
      if (take > 0) {
        next[p.id] = { amount: String(round2(take)), invoiceId: value[p.id]?.invoiceId ?? '' };
        left = round2(left - take);
      }
    }
    onChange(next);
  };

  if (!items) return null;
  if (projects.length === 0) return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">This client has no open project balances. The amount will be kept as an unallocated advance.</p>;

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm">
        <span>
          Allocated <strong className="tabular-nums">{pkr(allocated)}</strong> of <span className="tabular-nums">{pkr(available)}</span>
          {remaining !== 0 && <span className={cn('ml-2 tabular-nums', remaining < 0 ? 'text-red-600' : 'text-amber-600')}>({remaining < 0 ? 'over by ' : 'unallocated '} {pkr(Math.abs(remaining))})</span>}
        </span>
        <Button size="sm" variant="outline" onClick={autoFill} disabled={available <= 0}>
          <Wand2 /> Auto-allocate oldest first
        </Button>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Project</TH>
            <TH align="right">Contract</TH>
            <TH align="right">Balance</TH>
            <TH className="w-56">Against invoice</TH>
            <TH align="right" className="w-40">Allocate</TH>
          </TR>
        </THead>
        <TBody>
          {projects.map((p) => {
            const row = value[p.id] ?? { amount: '', invoiceId: '' };
            const over = Number(row.amount) > Number(p.balance);
            return (
              <TR key={p.id}>
                <TD>
                  <p className="font-medium">
                    {p.number} · {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.site.name}</p>
                </TD>
                <TD align="right">
                  <Money value={p.contractValue} />
                </TD>
                <TD align="right">
                  <Money value={p.balance} />
                </TD>
                <TD>
                  <Select className="h-8 text-xs" value={row.invoiceId} onChange={(e) => onChange({ ...value, [p.id]: { ...row, invoiceId: e.target.value } })} disabled={!p.invoices.length}>
                    <option value="">Project (no specific invoice)</option>
                    {p.invoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · bal {pkr(i.balance)}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD>
                  <Input className={cn('h-8 text-right', over && 'border-destructive')} inputMode="decimal" placeholder="0" value={row.amount} onChange={(e) => onChange({ ...value, [p.id]: { ...row, amount: e.target.value } })} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
