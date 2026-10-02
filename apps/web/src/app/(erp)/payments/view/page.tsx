'use client';

import { useAllocatePayment, useGetClientOpenItems, useGetPayment, useVoidPayment } from '@erp/api-client';
import { fmtDate, fmtDateTime, humanize, P } from '@erp/core';
import { Button, Card, CardContent, CardHeader, DescriptionList, Dialog, DialogContent, DialogFooter, Stat } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, Printer, Split } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AllocationEditor, allocatedTotal, allocationsFrom, type AllocationDraft } from '@/components/allocation-editor';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { DataTable, Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { useIdParam } from '@/lib/hooks';

export default function PaymentViewPage() {
  const id = useIdParam();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [allocating, setAllocating] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [alloc, setAlloc] = useState<AllocationDraft>({});
  const { data: p, isLoading } = useGetPayment(id, { query: { enabled: !!id } });
  const openItems = useGetClientOpenItems(p?.client.id ?? '', { query: { enabled: allocating && !!p } });
  const allocate = useAllocatePayment({
    mutation: {
      onSuccess: () => {
        toast.success('Allocation saved');
        setAllocating(false);
        qc.invalidateQueries();
      },
    },
  });
  const voidPayment = useVoidPayment({
    mutation: {
      onSuccess: () => {
        toast.success('Payment voided');
        setVoiding(false);
        qc.invalidateQueries();
      },
    },
  });

  if (isLoading) return <Loading />;
  if (!p) return <NotFound what="Payment" />;
  const unallocated = Number(p.unallocated);
  const posted = p.status === 'POSTED';

  return (
    <>
      <PageHeader
        back="/payments"
        title={`Receipt ${p.number}`}
        badge={<StatusBadge status={p.status} />}
        description={
          <>
            <Link className="text-primary hover:underline" href={`/clients/view?id=${p.client.id}`}>
              {p.client.name}
            </Link>{' '}
            · {fmtDate(p.paidOn)} · {humanize(p.method)}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            {posted && unallocated > 0 && (
              <Can permission={P.PAYMENT_CREATE}>
                <Button
                  onClick={() => {
                    setAlloc({});
                    setAllocating(true);
                  }}
                >
                  <Split /> Allocate advance
                </Button>
              </Can>
            )}
            {posted && (
              <Can permission={P.PAYMENT_VOID}>
                <Button variant="outline" onClick={() => setVoiding(true)}>
                  <Ban /> Void
                </Button>
              </Can>
            )}
          </>
        }
      />
      {p.status === 'VOIDED' && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Voided — {p.voidReason}. All allocations were reversed.
        </div>
      )}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Amount received" value={<Money value={p.amount} />} />
        <Stat label="Allocated" value={<Money value={p.allocated} />} tone="green" />
        <Stat label="Unallocated (advance)" value={<Money value={p.unallocated} />} tone={unallocated > 0 && posted ? 'amber' : 'default'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Allocations" />
          <DataTable
            rows={p.allocations}
            rowKey={(a) => a.id}
            empty={<p className="p-6 text-center text-sm text-muted-foreground">Not allocated to any project yet.</p>}
            columns={[
              { key: 'project', header: 'Project', cell: (a) => <Link className="text-primary hover:underline" href={`/projects/view?id=${a.project.id}`}>{a.project.number} · {a.project.name}</Link> },
              { key: 'site', header: 'Site', cell: (a) => a.site.name },
              { key: 'invoice', header: 'Invoice', cell: (a) => (a.invoice ? <Link className="text-primary hover:underline" href={`/invoices/view?id=${a.invoice.id}`}>{a.invoice.number}</Link> : '—') },
              { key: 'amount', header: 'Amount', align: 'right', cell: (a) => <Money value={a.amount} /> },
              { key: 'status', header: '', cell: (a) => a.status === 'VOIDED' && <StatusBadge status="VOIDED" /> },
            ]}
          />
        </Card>
        <Card>
          <CardContent>
            <DescriptionList
              columns={1}
              items={[
                { label: 'Reference', value: p.reference },
                { label: 'Bank', value: p.bank },
                { label: 'Cheque no.', value: p.chequeNo },
                { label: 'Transaction ID', value: p.transactionId },
                { label: 'Recorded', value: fmtDateTime(p.createdAt) },
                { label: 'Notes', value: p.notes },
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <DocumentsPanel ownerType="PAYMENT" ownerId={p.id} categories={['RECEIPT', 'OTHER']} defaultCategory="RECEIPT" canUpload={can(P.PAYMENT_CREATE)} title="Deposit slips & receipts" />
      </div>

      <Dialog open={allocating} onOpenChange={setAllocating}>
        <DialogContent title="Allocate advance" description={`Up to ${Number(p.unallocated).toLocaleString('en-PK')} PKR available`} size="xl">
          <AllocationEditor items={openItems.data} available={unallocated} value={alloc} onChange={setAlloc} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocating(false)}>
              Cancel
            </Button>
            <Button
              loading={allocate.isPending}
              disabled={allocatedTotal(alloc) <= 0 || allocatedTotal(alloc) > unallocated}
              onClick={() => allocate.mutate({ id: p.id, data: { allocations: allocationsFrom(alloc) } })}
            >
              Save allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void receipt ${p.number}?`}
        description="Reverses the receipt and every allocation with a correcting journal entry. This cannot be undone."
        reasonLabel="Reason"
        confirmLabel="Void payment"
        destructive
        loading={voidPayment.isPending}
        onConfirm={(reason) => voidPayment.mutate({ id: p.id, data: { reason } })}
      />
    </>
  );
}
