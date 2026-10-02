'use client';

import { useListCategories, useListStock } from '@erp/api-client';
import { P, qty } from '@erp/core';
import { Badge, Button, Checkbox, Input, Select } from '@erp/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { StockAdjustDialog } from '@/components/forms/stock-adjust';
import { DataTable, ListCard, Money, PageHeader, Pagination } from '@/components/page';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function InventoryPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [adjust, setAdjust] = useState<{ id: string; name: string; onHand: string } | null>(null);
  const [f, setF] = useQueryState({ q: '', categoryId: '', lowStock: '', page: 1 });
  const q = useDebounced(f.q);
  const { data: categories } = useListCategories();
  const { data, isLoading } = useListStock({ q: q || undefined, categoryId: f.categoryId || undefined, lowStock: (f.lowStock || undefined) as 'true' | undefined, page: f.page, pageSize: 50 });
  const showValue = can(P.PRODUCT_COST_VIEW);

  return (
    <>
      <PageHeader title="Inventory" description="On hand, reserved for projects, incoming on purchase orders, and available" />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search products…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />
            <Select value={f.categoryId} onChange={(e) => setF({ categoryId: e.target.value })} className="w-52">
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </Select>
            <Checkbox checked={f.lowStock === 'true'} onChange={(e) => setF({ lowStock: e.target.checked ? 'true' : '' })} label="Low stock only" />
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.productId}
          onRowClick={(r) => router.push(`/products/view?id=${r.productId}`)}
          columns={[
            { key: 'sku', header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            {
              key: 'name',
              header: 'Product',
              cell: (r) => (
                <span className="font-medium">
                  {r.name} {r.lowStock && <Badge tone="red">low</Badge>}
                </span>
              ),
            },
            { key: 'category', header: 'Category', cell: (r) => r.category ?? '—' },
            { key: 'onHand', header: 'On hand', align: 'right', cell: (r) => qty(r.onHand) },
            { key: 'reserved', header: 'Reserved', align: 'right', cell: (r) => qty(r.reserved) },
            { key: 'incoming', header: 'Incoming', align: 'right', cell: (r) => qty(r.incoming) },
            { key: 'available', header: 'Available', align: 'right', cell: (r) => <span className={r.lowStock ? 'font-semibold text-red-600' : 'font-medium'}>{qty(r.available)}</span> },
            { key: 'reorder', header: 'Reorder at', align: 'right', cell: (r) => qty(r.reorderLevel) },
            ...(showValue ? [{ key: 'value', header: 'Stock value', align: 'right' as const, cell: (r: NonNullable<typeof data>['data'][number]) => <Money value={r.stockValue} /> }] : []),
            ...(can(P.INVENTORY_MANAGE)
              ? [
                  {
                    key: 'act',
                    header: '',
                    align: 'right' as const,
                    cell: (r: NonNullable<typeof data>['data'][number]) => (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Adjust"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdjust({ id: r.productId, name: r.name, onHand: r.onHand });
                        }}
                      >
                        <SlidersHorizontal />
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <StockAdjustDialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)} product={adjust} />
    </>
  );
}
