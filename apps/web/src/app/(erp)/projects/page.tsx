'use client';

import { useListProjects, type ListProjectsStatus } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Input, Progress, Select } from '@erp/ui';
import { useRouter } from 'next/navigation';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { PROJECT_STATUSES } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function ProjectsPage() {
  const router = useRouter();
  const [f, setF] = useQueryState({ q: '', status: '', active: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListProjects({
    q: q || undefined,
    status: (f.status || undefined) as ListProjectsStatus | undefined,
    active: (f.active || undefined) as 'true' | 'false' | undefined,
    page: f.page,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader title="Projects" description="Approved quotations in execution" />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Number, name, client…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-64" />
            <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-48">
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
            <Select value={f.active} onChange={(e) => setF({ active: e.target.value })} className="w-40">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Closed</option>
            </Select>
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/projects/view?id=${r.id}`)}
          columns={[
            { key: 'number', header: 'Project', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            {
              key: 'name',
              header: 'Name',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.client.name} · {r.site.name}
                  </p>
                </div>
              ),
            },
            { key: 'value', header: 'Value', align: 'right', cell: (r) => <Money value={r.contractValue} /> },
            { key: 'received', header: 'Received', align: 'right', cell: (r) => <Money value={r.received} /> },
            { key: 'out', header: 'Outstanding', align: 'right', cell: (r) => <Money value={r.outstanding} colorize /> },
            {
              key: 'progress',
              header: 'Progress',
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <Progress value={r.overallProgress} className="w-24" />
                  <span className="text-xs text-muted-foreground">{Math.round(r.overallProgress)}%</span>
                </div>
              ),
            },
            { key: 'due', header: 'Target', cell: (r) => fmtDate(r.expectedCompletion) },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
    </>
  );
}
