'use client';

import { useListClients, type ListClientsType } from '@erp/api-client';
import { humanize, P } from '@erp/core';
import { Button, Input, Select } from '@erp/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can } from '@/components/auth';
import { ClientFormDialog } from '@/components/forms/client-form';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { CLIENT_TYPES } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function ClientsPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useQueryState({ q: '', type: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListClients({ q: q || undefined, type: (f.type || undefined) as ListClientsType | undefined, page: f.page, pageSize: 25 });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Residential, commercial and builder clients"
        actions={
          <Can permission={P.CLIENT_MANAGE}>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New client
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search name, code, phone…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />
            <Select value={f.type} onChange={(e) => setF({ type: e.target.value })} className="w-44">
              <option value="">All types</option>
              {CLIENT_TYPES.map((t) => (
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
          onRowClick={(r) => router.push(`/clients/view?id=${r.id}`)}
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            {
              key: 'name',
              header: 'Client',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  {r.companyName && <p className="text-xs text-muted-foreground">{r.companyName}</p>}
                </div>
              ),
            },
            { key: 'phone', header: 'Phone', cell: (r) => r.phone ?? '—' },
            { key: 'type', header: 'Type', cell: (r) => humanize(r.type) },
            { key: 'sites', header: 'Sites', align: 'right', cell: (r) => r.siteCount },
            { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (r) => <Money value={r.outstanding} colorize /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <ClientFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/clients/view?id=${id}`)} />
    </>
  );
}
