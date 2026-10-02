'use client';

import { useDuplicateQuotation, useListQuotations, type ListQuotationsStatus, type ListQuotationsType } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Input, Select } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Can } from '@/components/auth';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { QUOTATION_STATUSES } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function QuotationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useQueryState({ q: '', status: '', type: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListQuotations({
    q: q || undefined,
    status: (f.status || undefined) as ListQuotationsStatus | undefined,
    type: (f.type || undefined) as ListQuotationsType | undefined,
    page: f.page,
    pageSize: 25,
  });
  const dup = useDuplicateQuotation({
    mutation: {
      onSuccess: (row) => {
        toast.success(`Duplicated as ${row.displayNumber}`);
        qc.invalidateQueries();
        router.push(`/quotations/edit?id=${row.id}`);
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Product-based and site-division quotations"
        actions={
          <Can permission={P.QUOTATION_MANAGE}>
            <Button onClick={() => router.push('/quotations/new')}>
              <Plus /> New quotation
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Number, client, site…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-64" />
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-48">
              <option value="">All statuses</option>
              {QUOTATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
            <Select value={f.type} onChange={(e) => setF({ type: e.target.value })} className="w-44">
              <option value="">All types</option>
              <option value="PRODUCT">Product-based</option>
              <option value="SITE_DIVISION">Site division</option>
            </Select>
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(r.status === 'DRAFT' ? `/quotations/edit?id=${r.id}` : `/quotations/view?id=${r.id}`)}
          columns={[
            { key: 'number', header: 'Quotation', cell: (r) => <span className="font-mono text-xs">{r.displayNumber}</span> },
            { key: 'date', header: 'Date', cell: (r) => fmtDate(r.quotationDate) },
            { key: 'client', header: 'Client', cell: (r) => <span className="font-medium">{r.client.name}</span> },
            { key: 'site', header: 'Site', cell: (r) => r.site.name },
            { key: 'type', header: 'Type', cell: (r) => (r.type === 'SITE_DIVISION' ? 'Site division' : 'Product') },
            { key: 'total', header: 'Total', align: 'right', cell: (r) => <Money value={r.grandTotal} /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'act',
              header: '',
              align: 'right',
              cell: (r) => (
                <Can permission={P.QUOTATION_MANAGE}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Duplicate"
                    onClick={(e) => {
                      e.stopPropagation();
                      dup.mutate({ id: r.id, data: {} });
                    }}
                  >
                    <Copy />
                  </Button>
                </Can>
              ),
            },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
    </>
  );
}
