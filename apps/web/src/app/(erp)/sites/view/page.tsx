'use client';

import { useGetSite, useListProjects, useListQuotations } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Card, CardContent, DescriptionList, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { FilePlus2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can, useAuth } from '@/components/auth';
import { DocumentsPanel } from '@/components/documents-panel';
import { SiteFormDialog } from '@/components/forms/site-form';
import { LedgerView } from '@/components/ledger-view';
import { DataTable, Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { useIdParam } from '@/lib/hooks';

export default function SiteViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data: s, isLoading } = useGetSite(id, { query: { enabled: !!id } });
  const quotations = useListQuotations({ siteId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.QUOTATION_VIEW) } });
  const projects = useListProjects({ siteId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.PROJECT_VIEW) } });

  if (isLoading) return <Loading />;
  if (!s) return <NotFound what="Site" />;

  return (
    <>
      <PageHeader
        back="/sites"
        title={s.name}
        badge={<StatusBadge status={s.status} />}
        description={
          <>
            {s.code} · {humanize(s.type)} ·{' '}
            <Link className="text-primary hover:underline" href={`/clients/view?id=${s.client.id}`}>
              {s.client.name}
            </Link>
          </>
        }
        actions={
          <>
            <Can permission={P.SITE_MANAGE}>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            </Can>
            <Can permission={P.QUOTATION_MANAGE}>
              <Button onClick={() => router.push(`/quotations/new?clientId=${s.client.id}&siteId=${s.id}`)}>
                <FilePlus2 /> New quotation
              </Button>
            </Can>
          </>
        }
      />
      <Card className="mb-6">
        <CardContent>
          <DescriptionList
            columns={4}
            items={[
              { label: 'Address', value: s.address },
              { label: 'Project manager', value: s.manager?.name },
              { label: 'Start date', value: fmtDate(s.startDate) },
              { label: 'Expected completion', value: fmtDate(s.expectedCompletion) },
              { label: 'Notes', value: s.notes, wide: true },
            ]}
          />
        </CardContent>
      </Card>
      <Tabs defaultValue="projects">
        <TabsList className="mb-4">
          {can(P.PROJECT_VIEW) && <TabsTrigger value="projects">Projects</TabsTrigger>}
          {can(P.QUOTATION_VIEW) && <TabsTrigger value="quotations">Quotations</TabsTrigger>}
          {can(P.LEDGER_VIEW) && <TabsTrigger value="ledger">Site ledger</TabsTrigger>}
          <TabsTrigger value="documents">Drawings & photos</TabsTrigger>
        </TabsList>
        <TabsContent value="projects">
          <Card>
            <DataTable
              rows={projects.data?.data}
              loading={projects.isLoading}
              rowKey={(p) => p.id}
              onRowClick={(p) => router.push(`/projects/view?id=${p.id}`)}
              columns={[
                { key: 'number', header: 'Project', cell: (p) => <span className="font-mono text-xs">{p.number}</span> },
                { key: 'name', header: 'Name', cell: (p) => p.name },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
                { key: 'progress', header: 'Progress', align: 'right', cell: (p) => `${p.overallProgress}%` },
                { key: 'value', header: 'Contract', align: 'right', cell: (p) => <Money value={p.contractValue} /> },
                { key: 'received', header: 'Received', align: 'right', cell: (p) => <Money value={p.received} /> },
                { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (p) => <Money value={p.outstanding} colorize /> },
              ]}
            />
          </Card>
        </TabsContent>
        <TabsContent value="quotations">
          <Card>
            <DataTable
              rows={quotations.data?.data}
              loading={quotations.isLoading}
              rowKey={(q) => q.id}
              onRowClick={(q) => router.push(`/quotations/view?id=${q.id}`)}
              columns={[
                { key: 'number', header: 'Number', cell: (q) => <span className="font-mono text-xs">{q.displayNumber}</span> },
                { key: 'date', header: 'Date', cell: (q) => fmtDate(q.quotationDate) },
                { key: 'type', header: 'Type', cell: (q) => humanize(q.type) },
                { key: 'status', header: 'Status', cell: (q) => <StatusBadge status={q.status} /> },
                { key: 'total', header: 'Total', align: 'right', cell: (q) => <Money value={q.grandTotal} /> },
              ]}
            />
          </Card>
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerView party="client" id={s.client.id} siteId={s.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel ownerType="SITE" ownerId={s.id} defaultCategory="DRAWING" canUpload={can(P.SITE_MANAGE)} />
        </TabsContent>
      </Tabs>
      <SiteFormDialog open={editing} onOpenChange={setEditing} site={s as never} />
    </>
  );
}
