'use client';

import { useListSites, type ListSitesStatus, type ListSitesType } from '@erp/api-client';
import { humanize, P } from '@erp/core';
import { Button, Input, Select } from '@erp/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can } from '@/components/auth';
import { SiteFormDialog } from '@/components/forms/site-form';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { SITE_STATUSES, SITE_TYPES } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function SitesPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useQueryState({ q: '', status: '', type: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListSites({
    q: q || undefined,
    status: (f.status || undefined) as ListSitesStatus | undefined,
    type: (f.type || undefined) as ListSitesType | undefined,
    page: f.page,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader
        title="Sites"
        description="Houses, villas, offices and other client locations"
        actions={
          <Can permission={P.SITE_MANAGE}>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New site
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search site, code, address…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-44">
              <option value="">All statuses</option>
              {SITE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
            <Select value={f.type} onChange={(e) => setF({ type: e.target.value })} className="w-40">
              <option value="">All types</option>
              {SITE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/sites/view?id=${r.id}`)}
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            {
              key: 'name',
              header: 'Site',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.address ?? ''}</p>
                </div>
              ),
            },
            { key: 'client', header: 'Client', cell: (r) => (r.client as { name: string }).name },
            { key: 'type', header: 'Type', cell: (r) => humanize(r.type) },
            { key: 'manager', header: 'Manager', cell: (r) => (r.manager as { name: string } | null)?.name ?? '—' },
            { key: 'q', header: 'Quotes / projects', align: 'right', cell: (r) => `${r.quotationCount} / ${r.projectCount}` },
            { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (r) => <Money value={r.outstanding} colorize /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <SiteFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/sites/view?id=${id}`)} />
    </>
  );
}
