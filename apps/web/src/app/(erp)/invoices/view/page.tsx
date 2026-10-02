'use client';

import { downloadInvoicePdf, useCancelInvoice, useGetInvoice, useIssueInvoice } from '@erp/api-client';
import { fmtDate, humanize, P, qty } from '@erp/core';
import { Button, Card, CardContent, DescriptionList, Stat, Table, TBody, TD, TFoot, TH, THead, TR } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, FileDown, HandCoins, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { saveBlob } from '@/lib/files';
import { useIdParam } from '@/lib/hooks';

export default function InvoiceViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const { data: inv, isLoading } = useGetInvoice(id, { query: { enabled: !!id } });
  const issue = useIssueInvoice({ mutation: { onSuccess: () => (toast.success('Invoice issued'), qc.invalidateQueries()) } });
  const cancel = useCancelInvoice({ mutation: { onSuccess: () => (toast.success('Invoice cancelled'), setCancelling(false), qc.invalidateQueries()) } });

  if (isLoading) return <Loading />;
  if (!inv) return <NotFound what="Invoice" />;
  const payable = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status);

  return (
    <>
      <PageHeader
        back="/invoices"
        title={`Invoice ${inv.number}`}
        badge={<StatusBadge status={inv.status} />}
        description={
          <>
            <Link className="text-primary hover:underline" href={`/clients/view?id=${inv.client.id}`}>
              {inv.client.name}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" href={`/projects/view?id=${inv.project.id}`}>
              {inv.project.number} {inv.project.name}
            </Link>
            {' · '}
            {inv.site.name}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => saveBlob(() => downloadInvoicePdf(inv.id), `${inv.number}.pdf`, 'open')}>
              <FileDown /> PDF
            </Button>
            <Can permission={P.INVOICE_MANAGE}>
              {inv.status === 'DRAFT' && (
                <Button onClick={() => issue.mutate({ id: inv.id })} loading={issue.isPending}>
                  <Send /> Issue
                </Button>
              )}
              {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && Number(inv.paidAmount) === 0 && (
                <Button variant="outline" onClick={() => setCancelling(true)}>
                  <Ban /> Cancel
                </Button>
              )}
            </Can>
            {payable && (
              <Can permission={P.PAYMENT_CREATE}>
                <Button onClick={() => router.push(`/payments/new?clientId=${inv.client.id}`)}>
                  <HandCoins /> Record payment
                </Button>
              </Can>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Total" value={<Money value={inv.total} />} />
        <Stat label="Paid" value={<Money value={inv.paidAmount} />} tone="green" />
        <Stat label="Balance" value={<Money value={inv.balance} />} tone={Number(inv.balance) > 0 ? 'red' : 'default'} />
      </div>
      <Card className="mb-6">
        <CardContent>
          <DescriptionList
            columns={4}
            items={[
              { label: 'Type', value: inv.milestone ? `Milestone — ${inv.milestone.name}` : humanize(inv.kind) },
              { label: 'Invoice date', value: fmtDate(inv.invoiceDate) },
              { label: 'Due date', value: fmtDate(inv.dueDate) },
              { label: 'Created', value: fmtDate(inv.createdAt) },
              { label: 'Notes', value: inv.notes, wide: true },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Description</TH>
              <TH align="right">Qty</TH>
              <TH align="right">Unit price</TH>
              <TH align="right">Amount</TH>
            </TR>
          </THead>
          <TBody>
            {inv.items.map((i) => (
              <TR key={i.id}>
                <TD>{i.description}</TD>
                <TD align="right">{qty(i.qty)}</TD>
                <TD align="right">
                  <Money value={i.unitPrice} />
                </TD>
                <TD align="right">
                  <Money value={i.lineTotal} />
                </TD>
              </TR>
            ))}
          </TBody>
          <TFoot>
            <TR>
              <TD colSpan={3} className="text-right text-muted-foreground">
                Subtotal
              </TD>
              <TD align="right">
                <Money value={inv.subtotal} />
              </TD>
            </TR>
            {Number(inv.discount) > 0 && (
              <TR>
                <TD colSpan={3} className="text-right text-muted-foreground">
                  Discount
                </TD>
                <TD align="right">
                  − <Money value={inv.discount} />
                </TD>
              </TR>
            )}
            {Number(inv.tax) > 0 && (
              <TR>
                <TD colSpan={3} className="text-right text-muted-foreground">
                  Tax
                </TD>
                <TD align="right">
                  <Money value={inv.tax} />
                </TD>
              </TR>
            )}
            <TR>
              <TD colSpan={3} className="text-right">
                Total
              </TD>
              <TD align="right" className="text-base">
                <Money value={inv.total} />
              </TD>
            </TR>
          </TFoot>
        </Table>
      </Card>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel invoice ${inv.number}?`}
        description="Any receivable posted for this invoice is reversed. A milestone invoice frees the milestone to be billed again."
        reasonLabel="Reason"
        confirmLabel="Cancel invoice"
        destructive
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate({ id: inv.id, data: { reason } })}
      />
    </>
  );
}
