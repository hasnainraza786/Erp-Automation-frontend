'use client';

import { downloadPurchaseOrderPdf, useCancelPurchaseOrder, useGetPurchaseOrder, useReceivePurchaseOrder, useSendPurchaseOrder } from '@erp/api-client';
import { fmtDate, fmtDateTime, P, qty } from '@erp/core';
import { Button, Card, CardContent, CardHeader, DescriptionList, Dialog, DialogContent, DialogFooter, Field, Input, Progress, Table, TBody, TD, TFoot, TH, THead, TR, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, FileDown, PackageCheck, Pencil, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { saveBlob } from '@/lib/files';
import { useIdParam } from '@/lib/hooks';

export default function PurchaseOrderViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [recvNotes, setRecvNotes] = useState('');
  const { data: po, isLoading } = useGetPurchaseOrder(id, { query: { enabled: !!id } });
  const refresh = () => qc.invalidateQueries();
  const send = useSendPurchaseOrder({ mutation: { onSuccess: () => (toast.success('Marked as sent to vendor'), refresh()) } });
  const receive = useReceivePurchaseOrder({
    mutation: {
      onSuccess: () => {
        toast.success('Goods received into stock');
        setReceiving(false);
        refresh();
      },
    },
  });
  const cancel = useCancelPurchaseOrder({ mutation: { onSuccess: () => (toast.success('Purchase order cancelled'), setCancelling(false), refresh()) } });

  if (isLoading) return <Loading />;
  if (!po) return <NotFound what="Purchase order" />;
  const open = po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED';
  const pendingLines = po.items.filter((i) => Number(i.pendingQty) > 0);

  const startReceive = () => {
    setRecv(Object.fromEntries(pendingLines.map((i) => [i.id, String(Number(i.pendingQty))])));
    setRecvNotes('');
    setReceiving(true);
  };

  return (
    <>
      <PageHeader
        back="/purchase-orders"
        title={po.number}
        badge={<StatusBadge status={po.status} />}
        description={
          <>
            <Link className="text-primary hover:underline" href={`/vendors/view?id=${po.vendor.id}`}>
              {po.vendor.name}
            </Link>
            {po.project && (
              <>
                {' · for '}
                <Link className="text-primary hover:underline" href={`/projects/view?id=${po.project.id}`}>
                  {po.project.number} {po.project.name}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => saveBlob(() => downloadPurchaseOrderPdf(po.id), `${po.number}.pdf`, 'open')}>
              <FileDown /> PDF
            </Button>
            <Can permission={P.PURCHASE_MANAGE}>
              {po.status === 'DRAFT' && (
                <>
                  <Button variant="outline" onClick={() => router.push(`/purchase-orders/edit?id=${po.id}`)}>
                    <Pencil /> Edit
                  </Button>
                  <Button onClick={() => send.mutate({ id: po.id })} loading={send.isPending}>
                    <Send /> Mark sent
                  </Button>
                </>
              )}
              {open && (
                <Button onClick={startReceive}>
                  <PackageCheck /> Receive goods
                </Button>
              )}
              {(po.status === 'DRAFT' || (po.status === 'SENT' && po.receipts.length === 0)) && (
                <Button variant="outline" onClick={() => setCancelling(true)}>
                  <Ban /> Cancel
                </Button>
              )}
            </Can>
          </>
        }
      />
      <Card className="mb-6">
        <CardContent>
          <DescriptionList
            columns={4}
            items={[
              { label: 'Order date', value: fmtDate(po.orderDate) },
              { label: 'Expected delivery', value: fmtDate(po.expectedDelivery) },
              { label: 'Payment due', value: fmtDate(po.dueDate) },
              { label: 'Payment terms', value: po.paymentTerms },
              { label: 'Sent', value: po.confirmedAt && fmtDateTime(po.confirmedAt) },
              { label: 'Notes', value: po.notes, wide: true },
            ]}
          />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <Table>
          <THead>
            <TR>
              <TH>Product</TH>
              <TH align="right">Ordered</TH>
              <TH className="w-40">Received</TH>
              <TH align="right">Unit cost</TH>
              <TH align="right">Discount</TH>
              <TH align="right">Tax</TH>
              <TH align="right">Line total</TH>
            </TR>
          </THead>
          <TBody>
            {po.items.map((i) => (
              <TR key={i.id}>
                <TD>
                  <p className="font-medium">{i.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{i.sku}</p>
                </TD>
                <TD align="right">
                  {qty(i.qty)} {i.unit.toLowerCase()}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Progress value={(Number(i.receivedQty) / Number(i.qty)) * 100} className="flex-1" />
                    <span className="text-xs tabular-nums">{qty(i.receivedQty)}</span>
                  </div>
                </TD>
                <TD align="right">
                  <Money value={i.unitCost} />
                </TD>
                <TD align="right">{Number(i.discount) ? <Money value={i.discount} /> : '—'}</TD>
                <TD align="right">{Number(i.taxRate) ? `${Number(i.taxRate)}%` : '—'}</TD>
                <TD align="right">
                  <Money value={i.lineTotal} />
                </TD>
              </TR>
            ))}
          </TBody>
          <TFoot>
            <TR>
              <TD colSpan={6} className="text-right text-muted-foreground">
                Subtotal
              </TD>
              <TD align="right">
                <Money value={po.subtotal} />
              </TD>
            </TR>
            {Number(po.discount) > 0 && (
              <TR>
                <TD colSpan={6} className="text-right text-muted-foreground">
                  Discount
                </TD>
                <TD align="right">
                  − <Money value={po.discount} />
                </TD>
              </TR>
            )}
            <TR>
              <TD colSpan={6} className="text-right text-muted-foreground">
                Tax
              </TD>
              <TD align="right">
                <Money value={po.tax} />
              </TD>
            </TR>
            <TR>
              <TD colSpan={6} className="text-right">
                Total
              </TD>
              <TD align="right" className="text-base">
                <Money value={po.total} />
              </TD>
            </TR>
          </TFoot>
        </Table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Goods receipts" />
          <ul className="divide-y divide-border">
            {po.receipts.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nothing received yet.</li>}
            {po.receipts.map((r) => (
              <li key={r.id} className="px-4 py-2.5 text-sm">
                <span className="font-mono text-xs">{r.number}</span> · {fmtDateTime(r.receivedAt)}
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </li>
            ))}
          </ul>
        </Card>
        <DocumentsPanel ownerType="PURCHASE_ORDER" ownerId={po.id} categories={['PURCHASE_INVOICE', 'DELIVERY_CHALLAN', 'RECEIPT', 'OTHER']} defaultCategory="PURCHASE_INVOICE" canUpload={can(P.PURCHASE_MANAGE)} title="Vendor invoices & challans" />
      </div>

      <Dialog open={receiving} onOpenChange={setReceiving}>
        <DialogContent title="Receive goods" description="Enter quantities received now. Stock and the vendor payable update on save." size="lg">
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH align="right">Pending</TH>
                <TH align="right" className="w-36">Receive now</TH>
              </TR>
            </THead>
            <TBody>
              {pendingLines.map((i) => (
                <TR key={i.id}>
                  <TD>{i.name}</TD>
                  <TD align="right">{qty(i.pendingQty)}</TD>
                  <TD>
                    <Input className="text-right" inputMode="decimal" value={recv[i.id] ?? ''} onChange={(e) => setRecv({ ...recv, [i.id]: e.target.value })} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Field label="Notes (challan no., condition…)">
            <Textarea rows={2} value={recvNotes} onChange={(e) => setRecvNotes(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiving(false)}>
              Cancel
            </Button>
            <Button
              loading={receive.isPending}
              onClick={() => {
                const lines = Object.entries(recv)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([poItemId, v]) => ({ poItemId, qty: v }));
                if (!lines.length) return toast.error('Enter at least one quantity');
                receive.mutate({ id: po.id, data: { lines, notes: recvNotes || undefined } });
              }}
            >
              Save receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${po.number}?`}
        reasonLabel="Reason"
        confirmLabel="Cancel PO"
        destructive
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate({ id: po.id, data: { reason } })}
      />
    </>
  );
}
