'use client';

import { useListPurchaseOrders, type ListPurchaseOrdersStatus } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Input, Select } from '@erp/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Can } from '@/components/auth';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { useDebounced, useQueryState } from '@/lib/hooks';

const STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [f, setF] = useQueryState({ q: '', status: '', dateFrom: '', dateTo: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListPurchaseOrders({
    q: q || undefined,
    status: (f.status || undefined) as ListPurchaseOrdersStatus | undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    page: f.page,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders to vendors for project shortages and stock"
        actions={
          <Can permission={P.PURCHASE_MANAGE}>
            <Button onClick={() => router.push('/purchase-orders/edit')}>
              <Plus /> New PO
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search PO number, vendor…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-64" />
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-48">
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
          onRowClick={(r) => router.push(`/purchase-orders/view?id=${r.id}`)}
          columns={[
            { key: 'number', header: 'PO', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'date', header: 'Date', cell: (r) => fmtDate(r.orderDate) },
            { key: 'vendor', header: 'Vendor', cell: (r) => <span className="font-medium">{r.vendor.name}</span> },
            { key: 'project', header: 'For', cell: (r) => (r.project ? `${r.project.number} · ${r.project.name}` : 'Stock') },
            { key: 'expected', header: 'Expected', cell: (r) => fmtDate(r.expectedDelivery) },
            { key: 'due', header: 'Payment due', cell: (r) => fmtDate(r.dueDate) },
            { key: 'total', header: 'Total', align: 'right', cell: (r) => <Money value={r.total} /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
    </>
  );
}
