'use client';

import { useListPayments, type ListPaymentsMethod, type ListPaymentsStatus } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Checkbox, Input, Select } from '@erp/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Can } from '@/components/auth';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { PAYMENT_METHODS } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function PaymentsPage() {
  const router = useRouter();
  const [f, setF] = useQueryState({ q: '', method: '', status: '', unallocated: '', dateFrom: '', dateTo: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListPayments({
    q: q || undefined,
    method: (f.method || undefined) as ListPaymentsMethod | undefined,
    status: (f.status || undefined) as ListPaymentsStatus | undefined,
    unallocated: (f.unallocated || undefined) as 'true' | undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    page: f.page,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader
        title="Payments received"
        description="Client receipts and their allocation to projects"
        actions={
          <Can permission={P.PAYMENT_CREATE}>
            <Button onClick={() => router.push('/payments/new')}>
              <Plus /> Record payment
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Receipt no., reference, client…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-64" />
            <Select value={f.method} onChange={(e) => setF({ method: e.target.value })} className="w-40">
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {humanize(m)}
                </option>
              ))}
            </Select>
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-32">
              <option value="">Any status</option>
              <option value="POSTED">Posted</option>
              <option value="VOIDED">Voided</option>
            </Select>
            <Input type="date" value={f.dateFrom} onChange={(e) => setF({ dateFrom: e.target.value })} className="w-40" aria-label="From" />
            <Input type="date" value={f.dateTo} onChange={(e) => setF({ dateTo: e.target.value })} className="w-40" aria-label="To" />
            <Checkbox checked={f.unallocated === 'true'} onChange={(e) => setF({ unallocated: e.target.checked ? 'true' : '' })} label="Has unallocated" />
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/payments/view?id=${r.id}`)}
          columns={[
            { key: 'number', header: 'Receipt', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'date', header: 'Date', cell: (r) => fmtDate(r.paidOn) },
            { key: 'client', header: 'Client', cell: (r) => <span className="font-medium">{r.client.name}</span> },
            { key: 'method', header: 'Method', cell: (r) => humanize(r.method) },
            { key: 'ref', header: 'Reference', cell: (r) => r.reference ?? r.chequeNo ?? r.transactionId ?? '—' },
            { key: 'alloc', header: 'Projects', cell: (r) => r.allocations.filter((a) => a.status === 'POSTED').map((a) => a.project.number).join(', ') || '—' },
            { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
            { key: 'un', header: 'Unallocated', align: 'right', cell: (r) => (Number(r.unallocated) && r.status === 'POSTED' ? <Money value={r.unallocated} className="text-amber-600" /> : '—') },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
    </>
  );
}
