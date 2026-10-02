'use client';

import { useListVendorPayments, useListVendors } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { Banknote, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can, useAuth } from '@/components/auth';
import { VendorFormDialog } from '@/components/forms/vendor-form';
import { VendorPaymentDialog } from '@/components/forms/vendor-payment-form';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function VendorsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [f, setF] = useQueryState({ tab: 'vendors', q: '', status: 'ACTIVE', page: 1 });
  const q = useDebounced(f.q);
  const vendors = useListVendors({ q: q || undefined, status: (f.status || undefined) as 'ACTIVE' | 'ARCHIVED' | undefined, page: f.page, pageSize: 25 }, { query: { enabled: f.tab === 'vendors' } });
  const payments = useListVendorPayments({ q: q || undefined, page: f.page, pageSize: 25 }, { query: { enabled: f.tab === 'payments' && can(P.PURCHASE_VIEW) } });

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Suppliers, purchase dues and payments"
        actions={
          <>
            <Can permission={P.PAYMENT_CREATE}>
              <Button variant="outline" onClick={() => setPaying(true)}>
                <Banknote /> Pay vendor
              </Button>
            </Can>
            <Can permission={P.VENDOR_MANAGE}>
              <Button onClick={() => setCreating(true)}>
                <Plus /> New vendor
              </Button>
            </Can>
          </>
        }
      />
      <Tabs value={f.tab} onValueChange={(tab) => setF({ tab, page: 1 })}>
        <TabsList className="mb-4">
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          {can(P.PURCHASE_VIEW) && <TabsTrigger value="payments">Vendor payments</TabsTrigger>}
        </TabsList>
        <TabsContent value="vendors">
          <ListCard
            toolbar={
              <>
                <Input placeholder="Search vendors…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />
                <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-36">
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="">All</option>
                </Select>
              </>
            }
          >
            <DataTable
              rows={vendors.data?.data}
              loading={vendors.isLoading}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/vendors/view?id=${r.id}`)}
              columns={[
                { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
                { key: 'name', header: 'Vendor', cell: (r) => <span className="font-medium">{r.name}</span> },
                { key: 'contact', header: 'Contact', cell: (r) => [r.contactPerson, r.phone].filter(Boolean).join(' · ') || '—' },
                { key: 'terms', header: 'Terms', cell: (r) => r.paymentTerms ?? '—' },
                { key: 'outstanding', header: 'Payable', align: 'right', cell: (r) => <Money value={r.outstanding} colorize /> },
                { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
            <Pagination meta={vendors.data?.meta} onPage={(page) => setF({ page })} />
          </ListCard>
        </TabsContent>
        <TabsContent value="payments">
          <ListCard toolbar={<Input placeholder="Search number or reference…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />}>
            <DataTable
              rows={payments.data?.data}
              loading={payments.isLoading}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/vendors/view?id=${r.vendor.id}&tab=payments`)}
              columns={[
                { key: 'number', header: 'Number', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
                { key: 'date', header: 'Date', cell: (r) => fmtDate(r.paidOn) },
                { key: 'vendor', header: 'Vendor', cell: (r) => r.vendor.name },
                { key: 'method', header: 'Method', cell: (r) => humanize(r.method) },
                { key: 'ref', header: 'Reference', cell: (r) => r.reference ?? '—' },
                { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
                { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
            <Pagination meta={payments.data?.meta} onPage={(page) => setF({ page })} />
          </ListCard>
        </TabsContent>
      </Tabs>
      <VendorFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/vendors/view?id=${id}`)} />
      <VendorPaymentDialog open={paying} onOpenChange={setPaying} />
    </>
  );
}
