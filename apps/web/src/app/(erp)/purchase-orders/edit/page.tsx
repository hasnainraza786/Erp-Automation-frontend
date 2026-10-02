'use client';

import { getProduct, useCreatePurchaseOrder, useGetPurchaseOrder, useGetVendor, useUpdatePurchaseOrder } from '@erp/api-client';
import { pkr, todayInput, toDateInput } from '@erp/core';
import { Button, Card, CardContent, CardHeader, Field, Input, Table, TBody, TD, TH, THead, TR, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loading, PageHeader } from '@/components/page';
import { ProductPicker, ProjectPicker, VendorPicker } from '@/components/pickers';

interface Line {
  productId: string;
  sku: string;
  name: string;
  qty: string;
  unitCost: string;
  discount: string;
  taxRate: string;
}

const n = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const lineNet = (l: Line) => n(l.qty) * n(l.unitCost) - n(l.discount);
const lineTax = (l: Line) => (lineNet(l) * n(l.taxRate)) / 100;

export default function PurchaseOrderEditPage() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const existing = useGetPurchaseOrder(id, { query: { enabled: !!id } });
  const presetVendor = useGetVendor(params.get('vendorId') ?? '', { query: { enabled: !id && !!params.get('vendorId') } });

  const [vendor, setVendor] = useState<{ id: string; label: string } | null>(null);
  const [project, setProject] = useState<{ id: string; label: string } | null>(null);
  const [orderDate, setOrderDate] = useState(todayInput());
  const [expectedDelivery, setExpected] = useState('');
  const [dueDate, setDue] = useState('');
  const [paymentTerms, setTerms] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const po = existing.data;
    if (po) {
      setVendor({ id: po.vendor.id, label: po.vendor.name });
      setProject(po.project ? { id: po.project.id, label: `${po.project.number} · ${po.project.name}` } : null);
      setOrderDate(toDateInput(po.orderDate));
      setExpected(toDateInput(po.expectedDelivery));
      setDue(toDateInput(po.dueDate));
      setTerms(po.paymentTerms ?? '');
      setDiscount(Number(po.discount) ? po.discount : '');
      setNotes(po.notes ?? '');
      setLines(po.items.map((i) => ({ productId: i.productId, sku: i.sku, name: i.name, qty: String(Number(i.qty)), unitCost: i.unitCost, discount: Number(i.discount) ? i.discount : '', taxRate: String(Number(i.taxRate)) })));
      setLoaded(true);
    } else if (!id && (presetVendor.data || !params.get('vendorId'))) {
      if (presetVendor.data) {
        setVendor({ id: presetVendor.data.id, label: presetVendor.data.name });
        setTerms(presetVendor.data.paymentTerms ?? '');
      }
      setLoaded(true);
    }
  }, [existing.data, presetVendor.data, id, params, loaded]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
    const tax = lines.reduce((s, l) => s + lineTax(l), 0);
    return { subtotal, tax, total: subtotal - n(discount) + tax };
  }, [lines, discount]);

  const onSaved = (po: { id: string }) => {
    toast.success(id ? 'Purchase order updated' : 'Purchase order created');
    qc.invalidateQueries({ queryKey: ['/api/v1/purchase-orders'] });
    qc.invalidateQueries({ queryKey: [`/api/v1/purchase-orders/${po.id}`] });
    router.push(`/purchase-orders/view?id=${po.id}`);
  };
  const create = useCreatePurchaseOrder({ mutation: { onSuccess: onSaved } });
  const update = useUpdatePurchaseOrder({ mutation: { onSuccess: onSaved } });

  const addProduct = async (hit: { id: string; sku: string; name: string; taxRate: string }) => {
    if (lines.some((l) => l.productId === hit.id)) return toast.info(`${hit.name} is already on this PO`);
    const p = await getProduct(hit.id).catch(() => null);
    setLines((ls) => [...ls, { productId: hit.id, sku: hit.sku, name: hit.name, qty: '1', unitCost: p?.costPrice ?? '', discount: '', taxRate: '0' }]);
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = () => {
    if (!vendor) return toast.error('Select a vendor');
    if (!lines.length) return toast.error('Add at least one product');
    const data = {
      vendorId: vendor.id,
      projectId: project?.id ?? null,
      orderDate,
      expectedDelivery: expectedDelivery || null,
      dueDate: dueDate || null,
      paymentTerms: paymentTerms || null,
      discount: discount || '0',
      notes: notes || null,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost || undefined, discount: l.discount || '0', taxRate: l.taxRate || '0' })),
    };
    if (id) update.mutate({ id, data });
    else create.mutate({ data });
  };

  if ((id && existing.isLoading) || !loaded) return <Loading />;
  if (existing.data && existing.data.status !== 'DRAFT') {
    return <PageHeader back={`/purchase-orders/view?id=${id}`} title={`${existing.data.number} can no longer be edited`} description="Only draft purchase orders can be changed." />;
  }

  return (
    <>
      <PageHeader back={id ? `/purchase-orders/view?id=${id}` : '/purchase-orders'} title={id ? `Edit ${existing.data?.number}` : 'New purchase order'} />
      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Vendor" required>
              <VendorPicker value={vendor?.id} label={vendor?.label} onChange={(o) => setVendor(o)} />
            </Field>
            <Field label="For project" hint="Leave empty for general stock">
              <ProjectPicker value={project?.id} label={project?.label} onChange={(o) => setProject(o)} clearable />
            </Field>
            <Field label="Order date" required>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </Field>
            <Field label="Expected delivery">
              <Input type="date" value={expectedDelivery} onChange={(e) => setExpected(e.target.value)} />
            </Field>
            <Field label="Payment due">
              <Input type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Payment terms">
              <Input value={paymentTerms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Items" actions={<ProductPicker value={null} onPick={addProduct} className="w-80" />} />
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH align="right" className="w-28">Qty</TH>
                <TH align="right" className="w-36">Unit cost</TH>
                <TH align="right" className="w-32">Discount</TH>
                <TH align="right" className="w-24">Tax %</TH>
                <TH align="right" className="w-36">Line total</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {lines.map((l, i) => (
                <TR key={l.productId}>
                  <TD>
                    <p className="font-medium">{l.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{l.sku}</p>
                  </TD>
                  <TD>
                    <Input className="text-right" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                  </TD>
                  <TD>
                    <Input className="text-right" inputMode="decimal" value={l.unitCost} placeholder="product cost" onChange={(e) => setLine(i, { unitCost: e.target.value })} />
                  </TD>
                  <TD>
                    <Input className="text-right" inputMode="decimal" value={l.discount} placeholder="0" onChange={(e) => setLine(i, { discount: e.target.value })} />
                  </TD>
                  <TD>
                    <Input className="text-right" inputMode="decimal" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: e.target.value })} />
                  </TD>
                  <TD align="right" className="tabular-nums">
                    {pkr(lineNet(l) + lineTax(l))}
                  </TD>
                  <TD>
                    <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove">
                      <Trash2 />
                    </Button>
                  </TD>
                </TR>
              ))}
              {lines.length === 0 && (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Use “Add product” to build the order.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
          <div className="grid gap-6 border-t border-border p-5 md:grid-cols-2">
            <Field label="Notes">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <dl className="ml-auto w-full max-w-sm space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{pkr(totals.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Order discount</dt>
                <dd>
                  <Input className="h-8 w-36 text-right" inputMode="decimal" value={discount} placeholder="0" onChange={(e) => setDiscount(e.target.value)} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">{pkr(totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{pkr(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending || update.isPending}>
            {id ? 'Save changes' : 'Create draft PO'}
          </Button>
        </div>
      </div>
    </>
  );
}
