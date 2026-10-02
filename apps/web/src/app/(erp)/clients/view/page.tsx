'use client';

import { useGetClient, useListPayments, useListProjects, useListQuotations } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Card, CardContent, DescriptionList, Stat, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { FilePlus2, HandCoins, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can, useAuth } from '@/components/auth';
import { DocumentsPanel } from '@/components/documents-panel';
import { ClientFormDialog } from '@/components/forms/client-form';
import { SiteFormDialog } from '@/components/forms/site-form';
import { LedgerView } from '@/components/ledger-view';
import { DataTable, Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { useIdParam } from '@/lib/hooks';

export default function ClientViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [newSite, setNewSite] = useState(false);
  const { data: c, isLoading } = useGetClient(id, { query: { enabled: !!id } });
  const quotations = useListQuotations({ clientId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.QUOTATION_VIEW) } });
  const projects = useListProjects({ clientId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.PROJECT_VIEW) } });
  const payments = useListPayments({ clientId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.PAYMENT_VIEW) } });

  if (isLoading) return <Loading />;
  if (!c) return <NotFound what="Client" />;

  return (
    <>
      <PageHeader
        back="/clients"
        title={c.name}
        badge={<StatusBadge status={c.status} />}
        description={`${c.code} · ${humanize(c.type)}${c.companyName ? ` · ${c.companyName}` : ''}`}
        actions={
          <>
            <Can permission={P.CLIENT_MANAGE}>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            </Can>
            <Can permission={P.PAYMENT_CREATE}>
              <Button variant="outline" onClick={() => router.push(`/payments/new?clientId=${c.id}`)}>
                <HandCoins /> Record payment
              </Button>
            </Can>
            <Can permission={P.QUOTATION_MANAGE}>
              <Button onClick={() => router.push(`/quotations/new?clientId=${c.id}`)}>
                <FilePlus2 /> New quotation
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Quoted" value={<Money value={c.overview.quotationValue} />} />
        <Stat label="Approved" value={<Money value={c.overview.approvedValue} />} />
        <Stat label="Invoiced" value={<Money value={c.overview.invoiced} />} />
        <Stat label="Received" value={<Money value={c.overview.received} />} tone="green" />
        <Stat label="Outstanding" value={<Money value={c.overview.outstanding} />} tone={Number(c.overview.outstanding) > 0 ? 'red' : 'default'} />
        <Stat label="Unallocated" value={<Money value={c.overview.unallocated} />} tone={Number(c.overview.unallocated) > 0 ? 'amber' : 'default'} hint="Advance not yet allocated" />
      </div>

      <Tabs defaultValue="sites">
        <TabsList className="mb-4">
          <TabsTrigger value="sites">Sites ({c.sites.length})</TabsTrigger>
          {can(P.QUOTATION_VIEW) && <TabsTrigger value="quotations">Quotations</TabsTrigger>}
          {can(P.PROJECT_VIEW) && <TabsTrigger value="projects">Projects</TabsTrigger>}
          {can(P.PAYMENT_VIEW) && <TabsTrigger value="payments">Payments</TabsTrigger>}
          {can(P.LEDGER_VIEW) && <TabsTrigger value="ledger">Ledger</TabsTrigger>}
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="sites">
          <Card>
            <div className="flex justify-end border-b border-border p-3">
              <Can permission={P.SITE_MANAGE}>
                <Button size="sm" onClick={() => setNewSite(true)}>
                  <Plus /> Add site
                </Button>
              </Can>
            </div>
            <DataTable
              rows={c.sites}
              rowKey={(s) => s.id}
              onRowClick={(s) => router.push(`/sites/view?id=${s.id}`)}
              columns={[
                { key: 'code', header: 'Code', cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
                { key: 'name', header: 'Site', cell: (s) => <span className="font-medium">{s.name}</span> },
                { key: 'address', header: 'Address', cell: (s) => <span className="text-muted-foreground">{s.address ?? '—'}</span> },
                { key: 'type', header: 'Type', cell: (s) => humanize(s.type) },
                { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
                { key: 'value', header: 'Project value', align: 'right', cell: (s) => <Money value={s.projectValue} /> },
                { key: 'received', header: 'Received', align: 'right', cell: (s) => <Money value={s.received} /> },
                { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (s) => <Money value={s.outstanding} colorize /> },
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
                { key: 'site', header: 'Site', cell: (q) => q.site.name },
                { key: 'type', header: 'Type', cell: (q) => humanize(q.type) },
                { key: 'status', header: 'Status', cell: (q) => <StatusBadge status={q.status} /> },
                { key: 'total', header: 'Total', align: 'right', cell: (q) => <Money value={q.grandTotal} /> },
              ]}
            />
          </Card>
        </TabsContent>

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
                { key: 'site', header: 'Site', cell: (p) => p.site.name },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
                { key: 'value', header: 'Contract', align: 'right', cell: (p) => <Money value={p.contractValue} /> },
                { key: 'received', header: 'Received', align: 'right', cell: (p) => <Money value={p.received} /> },
                { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (p) => <Money value={p.outstanding} colorize /> },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <DataTable
              rows={payments.data?.data}
              loading={payments.isLoading}
              rowKey={(p) => p.id}
              onRowClick={(p) => router.push(`/payments/view?id=${p.id}`)}
              columns={[
                { key: 'number', header: 'Receipt', cell: (p) => <span className="font-mono text-xs">{p.number}</span> },
                { key: 'date', header: 'Date', cell: (p) => fmtDate(p.paidOn) },
                { key: 'method', header: 'Method', cell: (p) => humanize(p.method) },
                { key: 'projects', header: 'Allocated to', cell: (p) => p.allocations.filter((a) => a.status === 'POSTED').map((a) => a.project.number).join(', ') || '—' },
                { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} /> },
                { key: 'unallocated', header: 'Unallocated', align: 'right', cell: (p) => (Number(p.unallocated) ? <Money value={p.unallocated} className="text-amber-600" /> : '—') },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerView party="client" id={c.id} />
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent>
              <DescriptionList
                columns={3}
                items={[
                  { label: 'Contact person', value: c.contactPerson },
                  { label: 'Phone', value: c.phone },
                  { label: 'WhatsApp', value: c.whatsapp && <Link className="text-primary hover:underline" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '').replace(/^0/, '92')}`} target="_blank">{c.whatsapp}</Link> },
                  { label: 'Email', value: c.email },
                  { label: 'CNIC / NTN', value: c.cnicNtn },
                  { label: 'Client since', value: fmtDate(c.createdAt) },
                  { label: 'Billing address', value: c.billingAddress, wide: true },
                  { label: 'Notes', value: c.notes, wide: true },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel ownerType="CLIENT" ownerId={c.id} defaultCategory="CNIC" canUpload={can(P.CLIENT_MANAGE)} />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} />
      <SiteFormDialog open={newSite} onOpenChange={setNewSite} clientId={c.id} clientName={c.name} onSaved={(sid) => router.push(`/sites/view?id=${sid}`)} />
    </>
  );
}
