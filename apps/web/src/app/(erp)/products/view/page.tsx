'use client';

import { useGetProduct, useGetProductPriceHistory, useListInventoryTransactions } from '@erp/api-client';
import { fmtDateTime, humanize, P, pkr, qty } from '@erp/core';
import { Badge, Button, Card, CardContent, CardHeader, DescriptionList, Stat } from '@erp/ui';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Can, useAuth } from '@/components/auth';
import { DocumentsPanel } from '@/components/documents-panel';
import { ProductFormDialog } from '@/components/forms/product-form';
import { StockAdjustDialog } from '@/components/forms/stock-adjust';
import { DataTable, Loading, Money, NotFound, PageHeader } from '@/components/page';
import { useIdParam } from '@/lib/hooks';

export default function ProductViewPage() {
  const id = useIdParam();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const { data: p, isLoading } = useGetProduct(id, { query: { enabled: !!id } });
  const history = useGetProductPriceHistory(id, { query: { enabled: !!id } });
  const txns = useListInventoryTransactions(id, { pageSize: 20 }, { query: { enabled: !!id && can(P.INVENTORY_VIEW) } });

  if (isLoading) return <Loading />;
  if (!p) return <NotFound what="Product" />;
  const priceField = (f: string, v: string | null) => (f === 'taxRate' ? `${v ?? '—'}%` : v == null ? '—' : pkr(v));

  return (
    <>
      <PageHeader
        back="/products"
        title={p.name}
        badge={!p.isActive && <Badge tone="gray">inactive</Badge>}
        description={`${p.sku}${p.brand ? ` · ${p.brand}` : ''}${p.model ? ` · ${p.model}` : ''}`}
        actions={
          <>
            <Can permission={P.INVENTORY_MANAGE}>
              <Button variant="outline" onClick={() => setAdjusting(true)}>
                <SlidersHorizontal /> Adjust stock
              </Button>
            </Can>
            <Can permission={P.PRODUCT_MANAGE}>
              <Button onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="On hand" value={qty(p.stock.onHand)} />
        <Stat label="Reserved for projects" value={qty(p.stock.reserved)} />
        <Stat label="Incoming (open POs)" value={qty(p.stock.incoming)} />
        <Stat label="Available" value={qty(p.stock.available)} tone={Number(p.stock.available) <= Number(p.reorderLevel) ? 'red' : 'green'} hint={`Reorder at ${qty(p.reorderLevel)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <DescriptionList
              columns={3}
              items={[
                { label: 'Category', value: [p.category?.name, p.subcategory?.name].filter(Boolean).join(' › ') },
                { label: 'Unit', value: humanize(p.unit) },
                { label: 'Default supplier', value: p.supplier && <Link className="text-primary hover:underline" href={`/vendors/view?id=${p.supplier.id}`}>{p.supplier.name}</Link> },
                ...(can(P.PRODUCT_COST_VIEW) ? [{ label: 'Cost price', value: <Money value={p.costPrice} /> }] : []),
                { label: 'Selling price', value: <Money value={p.sellingPrice} /> },
                { label: 'Minimum price', value: p.minPrice && <Money value={p.minPrice} /> },
                { label: 'Special price', value: p.specialPrice && <Money value={p.specialPrice} /> },
                { label: 'Tax', value: `${Number(p.taxRate)}%` },
                { label: 'Warranty', value: p.warranty },
                { label: 'Description', value: p.description, wide: true },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Price history" />
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {history.data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">No price changes yet.</li>}
            {history.data?.map((h) => (
              <li key={h.id} className="px-4 py-2.5 text-sm">
                <p>
                  <span className="font-medium">{humanize(h.field)}</span>: {priceField(h.field, h.oldValue)} → <span className="font-medium">{priceField(h.field, h.newValue)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.changedByName ?? 'System'} · {fmtDateTime(h.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {can(P.INVENTORY_VIEW) && (
        <Card className="mt-6">
          <CardHeader title="Stock movements" />
          <DataTable
            rows={txns.data?.data}
            loading={txns.isLoading}
            rowKey={(t) => t.id}
            columns={[
              { key: 'date', header: 'Date', cell: (t) => fmtDateTime(t.createdAt) },
              { key: 'type', header: 'Type', cell: (t) => humanize(t.type) },
              { key: 'qty', header: 'Qty', align: 'right', cell: (t) => <span className={Number(t.qty) < 0 ? 'text-red-600' : 'text-emerald-600'}>{qty(t.qty)}</span> },
              { key: 'project', header: 'Project', cell: (t) => (t.project ? <Link className="text-primary hover:underline" href={`/projects/view?id=${t.project.id}`}>{t.project.number}</Link> : '—') },
              { key: 'notes', header: 'Notes', cell: (t) => <span className="text-muted-foreground">{t.notes ?? humanize(t.refType ?? '')}</span> },
            ]}
          />
        </Card>
      )}
      <div className="mt-6">
        <DocumentsPanel ownerType="PRODUCT" ownerId={p.id} categories={['PRODUCT_IMAGE', 'DATASHEET', 'OTHER']} defaultCategory="PRODUCT_IMAGE" canUpload={can(P.PRODUCT_MANAGE)} title="Images & datasheets" />
      </div>
      <ProductFormDialog open={editing} onOpenChange={setEditing} product={p} />
      <StockAdjustDialog open={adjusting} onOpenChange={setAdjusting} product={{ id: p.id, name: p.name, onHand: p.stock.onHand }} />
    </>
  );
}
