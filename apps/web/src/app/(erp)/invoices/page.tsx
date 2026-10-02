'use client';

import { useListInvoices, type ListInvoicesStatus } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Input, Select } from '@erp/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can } from '@/components/auth';
import { InvoiceFormDialog } from '@/components/forms/invoice-form';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { useDebounced, useQueryState } from '@/lib/hooks';

const STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

export default function InvoicesPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useQueryState({ q: '', status: '', dateFrom: '', dateTo: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListInvoices({
    q: q || undefined,
    status: (f.status || undefined) as ListInvoicesStatus | undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    page: f.page,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Milestone, balance and additional-work invoices"
        actions={
          <Can permission={P.INVOICE_MANAGE}>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New invoice
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Invoice no., client, project…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-64" />
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-44">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
            <Input type="date" value={f.dateFrom} onChange={(e) => setF({ dateFrom: e.target.value })} className="w-40" aria-label="From" />
            <Input type="date" value={f.dateTo} onChange={(e) => setF({ dateTo: e.target.value })} className="w-40" aria-label="To" />
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/invoices/view?id=${r.id}`)}
          columns={[
            { key: 'number', header: 'Invoice', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'date', header: 'Date', cell: (r) => fmtDate(r.invoiceDate) },
            { key: 'client', header: 'Client', cell: (r) => <span className="font-medium">{r.client.name}</span> },
            { key: 'project', header: 'Project', cell: (r) => r.project.number },
            { key: 'kind', header: 'Type', cell: (r) => (r.milestone ? r.milestone.name : humanize(r.kind)) },
            { key: 'due', header: 'Due', cell: (r) => fmtDate(r.dueDate) },
            { key: 'total', header: 'Total', align: 'right', cell: (r) => <Money value={r.total} /> },
            { key: 'balance', header: 'Balance', align: 'right', cell: (r) => <Money value={r.balance} colorize /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <InvoiceFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
