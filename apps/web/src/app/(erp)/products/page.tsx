'use client';

import { useListCategories, useListProducts } from '@erp/api-client';
import { humanize, P, qty } from '@erp/core';
import { Badge, Button, Checkbox, Input, Select } from '@erp/ui';
import { FolderTree, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Can, useAuth } from '@/components/auth';
import { CategoriesDialog } from '@/components/forms/categories-dialog';
import { ProductFormDialog } from '@/components/forms/product-form';
import { DataTable, ListCard, Money, PageHeader, Pagination } from '@/components/page';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function ProductsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [cats, setCats] = useState(false);
  const [f, setF] = useQueryState({ q: '', categoryId: '', active: 'true', lowStock: '', page: 1 });
  const q = useDebounced(f.q);
  const { data: categories } = useListCategories();
  const { data, isLoading } = useListProducts({
    q: q || undefined,
    categoryId: f.categoryId || undefined,
    active: (f.active || undefined) as 'true' | 'false' | undefined,
    lowStock: (f.lowStock || undefined) as 'true' | undefined,
    page: f.page,
    pageSize: 25,
  });
  const showCost = can(P.PRODUCT_COST_VIEW);

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalogue used in quotations, purchasing and inventory"
        actions={
          <Can permission={P.PRODUCT_MANAGE}>
            <Button variant="outline" onClick={() => setCats(true)}>
              <FolderTree /> Categories
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New product
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search SKU, name, brand, model…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />
            <Select value={f.categoryId} onChange={(e) => setF({ categoryId: e.target.value })} className="w-52">
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </Select>
            <Select value={f.active} onChange={(e) => setF({ active: e.target.value })} className="w-36">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All</option>
            </Select>
            <Checkbox checked={f.lowStock === 'true'} onChange={(e) => setF({ lowStock: e.target.checked ? 'true' : '' })} label="Low stock only" />
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/products/view?id=${r.id}`)}
          columns={[
            { key: 'sku', header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            {
              key: 'name',
              header: 'Product',
              cell: (r) => (
                <div>
                  <p className="font-medium">
                    {r.name} {!r.isActive && <Badge>inactive</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{[r.brand, r.model].filter(Boolean).join(' · ')}</p>
                </div>
              ),
            },
            { key: 'category', header: 'Category', cell: (r) => [r.category?.name, r.subcategory?.name].filter(Boolean).join(' › ') || '—' },
            { key: 'unit', header: 'Unit', cell: (r) => humanize(r.unit) },
            ...(showCost ? [{ key: 'cost', header: 'Cost', align: 'right' as const, cell: (r: (typeof data & object)['data'][number]) => <Money value={r.costPrice} /> }] : []),
            { key: 'price', header: 'Selling', align: 'right', cell: (r) => <Money value={r.sellingPrice} /> },
            {
              key: 'stock',
              header: 'Available',
              align: 'right',
              cell: (r) => <span className={Number(r.stock.available) <= Number(r.reorderLevel) ? 'font-medium text-red-600' : ''}>{qty(r.stock.available)}</span>,
            },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <ProductFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/products/view?id=${id}`)} />
      <CategoriesDialog open={cats} onOpenChange={setCats} />
    </>
  );
}
