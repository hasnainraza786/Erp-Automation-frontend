'use client';

import { useGetVendor, useListPurchaseOrders, useListVendorPayments, useVoidVendorPayment } from '@erp/api-client';
import { fmtDate, humanize, P } from '@erp/core';
import { Button, Card, CardContent, DescriptionList, Stat, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { Ban, Banknote, Pencil, ShoppingCart } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { VendorFormDialog } from '@/components/forms/vendor-form';
import { VendorPaymentDialog } from '@/components/forms/vendor-payment-form';
import { LedgerView } from '@/components/ledger-view';
import { DataTable, Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { useIdParam } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function VendorViewPage() {
  const id = useIdParam();
  const tab = useSearchParams().get('tab') ?? 'orders';
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const { data: v, isLoading } = useGetVendor(id, { query: { enabled: !!id } });
  const orders = useListPurchaseOrders({ vendorId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.PURCHASE_VIEW) } });
  const payments = useListVendorPayments({ vendorId: id, pageSize: 50 }, { query: { enabled: !!id && can(P.PURCHASE_VIEW) } });
  const voidPayment = useVoidVendorPayment({
    mutation: {
      onSuccess: () => {
        toast.success('Payment voided');
        setVoiding(null);
        qc.invalidateQueries();
      },
    },
  });

  if (isLoading) return <Loading />;
  if (!v) return <NotFound what="Vendor" />;
  const purchased = orders.data?.data.filter((o) => o.status !== 'DRAFT' && o.status !== 'CANCELLED').reduce((s, o) => s + Number(o.total), 0) ?? 0;

  return (
    <>
      <PageHeader
        back="/vendors"
        title={v.name}
        badge={<StatusBadge status={v.status} />}
        description={v.code}
        actions={
          <>
            <Can permission={P.VENDOR_MANAGE}>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            </Can>
            <Can permission={P.PURCHASE_MANAGE}>
              <Button variant="outline" onClick={() => router.push(`/purchase-orders/edit?vendorId=${v.id}`)}>
                <ShoppingCart /> New PO
              </Button>
            </Can>
            <Can permission={P.PAYMENT_CREATE}>
              <Button onClick={() => setPaying(true)}>
                <Banknote /> Pay vendor
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Payable balance" value={<Money value={v.outstanding} />} tone={Number(v.outstanding) > 0 ? 'red' : 'default'} />
        <Stat label="Purchased (listed POs)" value={<Money value={purchased} />} />
        <Stat label="Credit limit" value={v.creditLimit ? <Money value={v.creditLimit} /> : '—'} />
        <Stat label="Payment terms" value={v.paymentTerms ?? '—'} />
      </div>
      <Tabs defaultValue={tab}>
        <TabsList className="mb-4">
          {can(P.PURCHASE_VIEW) && <TabsTrigger value="orders">Purchase orders</TabsTrigger>}
          {can(P.PURCHASE_VIEW) && <TabsTrigger value="payments">Payments</TabsTrigger>}
          {can(P.LEDGER_VIEW) && <TabsTrigger value="ledger">Ledger</TabsTrigger>}
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <Card>
            <DataTable
              rows={orders.data?.data}
              loading={orders.isLoading}
              rowKey={(o) => o.id}
              onRowClick={(o) => router.push(`/purchase-orders/view?id=${o.id}`)}
              columns={[
                { key: 'number', header: 'PO', cell: (o) => <span className="font-mono text-xs">{o.number}</span> },
                { key: 'date', header: 'Date', cell: (o) => fmtDate(o.orderDate) },
                { key: 'project', header: 'Project', cell: (o) => o.project?.number ?? 'Stock' },
                { key: 'due', header: 'Due', cell: (o) => fmtDate(o.dueDate) },
                { key: 'total', header: 'Total', align: 'right', cell: (o) => <Money value={o.total} /> },
                { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
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
              columns={[
                { key: 'number', header: 'Number', cell: (p) => <span className="font-mono text-xs">{p.number}</span> },
                { key: 'date', header: 'Date', cell: (p) => fmtDate(p.paidOn) },
                { key: 'method', header: 'Method', cell: (p) => humanize(p.method) },
                { key: 'ref', header: 'Reference', cell: (p) => p.reference ?? '—' },
                { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} /> },
                { key: 'status', header: 'Status', cell: (p) => <span title={p.voidReason ?? undefined}><StatusBadge status={p.status} /></span> },
                {
                  key: 'act',
                  header: '',
                  align: 'right',
                  cell: (p) =>
                    p.status === 'POSTED' &&
                    can(P.PAYMENT_VOID) && (
                      <Button variant="ghost" size="sm" onClick={() => setVoiding(p.id)}>
                        <Ban /> Void
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerView party="vendor" id={v.id} />
        </TabsContent>
        <TabsContent value="details">
          <Card>
            <CardContent>
              <DescriptionList
                columns={3}
                items={[
                  { label: 'Contact person', value: v.contactPerson },
                  { label: 'Phone', value: v.phone },
                  { label: 'Email', value: v.email },
                  { label: 'NTN / STRN', value: v.taxInfo },
                  { label: 'Since', value: fmtDate(v.createdAt) },
                  { label: 'Address', value: v.address, wide: true },
                  { label: 'Notes', value: v.notes, wide: true },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <VendorFormDialog open={editing} onOpenChange={setEditing} vendor={v} />
      <VendorPaymentDialog open={paying} onOpenChange={setPaying} vendor={{ id: v.id, name: v.name }} outstanding={v.outstanding} />
      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Void vendor payment"
        description="A reversing journal entry is posted; the payment stays on record as voided."
        reasonLabel="Reason"
        confirmLabel="Void payment"
        destructive
        loading={voidPayment.isPending}
        onConfirm={(reason) => voiding && voidPayment.mutate({ id: voiding, data: { reason } })}
      />
    </>
  );
}
