'use client';

import { getListProductsQueryKey, useCreateProduct, useListCategories, useUpdateProduct, type ProductDtoOutput } from '@erp/api-client';
import { humanize, P } from '@erp/core';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth';
import { VendorPicker } from '@/components/pickers';
import { applyServerErrors, clean, UNITS } from '@/lib/forms';

type Values = {
  sku: string;
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  subcategoryId: string;
  description: string;
  unit: (typeof UNITS)[number];
  costPrice: string;
  sellingPrice: string;
  minPrice: string;
  specialPrice: string;
  taxRate: string;
  supplierId: string;
  warranty: string;
  reorderLevel: string;
  isActive: boolean;
};

const empty: Values = {
  sku: '', name: '', brand: '', model: '', categoryId: '', subcategoryId: '', description: '', unit: 'PIECE',
  costPrice: '', sellingPrice: '', minPrice: '', specialPrice: '', taxRate: '0', supplierId: '', warranty: '', reorderLevel: '0', isActive: true,
};

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; product?: ProductDtoOutput; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const showCost = can(P.PRODUCT_COST_VIEW);
  const { data: categories } = useListCategories({ query: { enabled: open } });
  const form = useForm<Values>({ defaultValues: empty });
  const { register, handleSubmit, reset, setError, formState, watch, control } = form;
  const categoryId = watch('categoryId');
  const roots = categories?.filter((c) => !c.parentId && c.isActive) ?? [];
  const subs = categories?.filter((c) => c.parentId === categoryId && c.isActive) ?? [];

  const [supplierName, setSupplierName] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setSupplierName(product?.supplier?.name);
    reset(
      product
        ? (Object.fromEntries(Object.entries(empty).map(([k, d]) => [k, (product as unknown as Record<string, unknown>)[k] ?? d])) as Values)
        : empty,
    );
  }, [open, product, reset]);

  const opts = {
    mutation: {
      meta: { silent: true },
      onSuccess: (p: { id: string }) => {
        toast.success(product ? 'Product updated' : 'Product created');
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        qc.invalidateQueries({ queryKey: [`/api/v1/products/${p.id}`] });
        onOpenChange(false);
        onSaved?.(p.id);
      },
      onError: (e: unknown) => {
        if (!applyServerErrors(e, setError, Object.keys(empty))) toast.error((e as Error).message);
      },
    },
  };
  const create = useCreateProduct(opts);
  const update = useUpdateProduct(opts);

  const submit = handleSubmit((v) => {
    const body = { ...v } as Partial<Values>;
    if (!showCost) delete body.costPrice;
    if (product) update.mutate({ id: product.id, data: clean(body, 'update') });
    else create.mutate({ data: clean(body) as never });
  });

  const money = { inputMode: 'decimal' as const, placeholder: '0' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={product ? `Edit ${product.name}` : 'New product'} size="xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
          <Field label="SKU / code" required error={formState.errors.sku?.message}>
            <Input {...register('sku', { required: 'SKU is required' })} autoFocus={!product} />
          </Field>
          <Field label="Name" required error={formState.errors.name?.message} className="sm:col-span-2">
            <Input {...register('name', { required: 'Name is required' })} />
          </Field>
          <Field label="Brand">
            <Input {...register('brand')} />
          </Field>
          <Field label="Model">
            <Input {...register('model')} />
          </Field>
          <Field label="Unit">
            <Select {...register('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {humanize(u)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" error={formState.errors.categoryId?.message}>
            <Select {...register('categoryId', { onChange: () => form.setValue('subcategoryId', '') })}>
              <option value="">—</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subcategory" error={formState.errors.subcategoryId?.message}>
            <Select {...register('subcategoryId')} disabled={!subs.length}>
              <option value="">—</option>
              {subs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default supplier">
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <VendorPicker
                  clearable
                  value={field.value || null}
                  label={supplierName}
                  onChange={(o) => {
                    setSupplierName(o?.label);
                    field.onChange(o?.id ?? '');
                  }}
                />
              )}
            />
          </Field>
          {showCost && (
            <Field label="Cost price (PKR)" error={formState.errors.costPrice?.message}>
              <Input {...register('costPrice')} {...money} />
            </Field>
          )}
          <Field label="Selling price (PKR)" required error={formState.errors.sellingPrice?.message}>
            <Input {...register('sellingPrice', { required: 'Selling price is required' })} {...money} />
          </Field>
          <Field label="Minimum price" hint="Quotes below this need price-override permission" error={formState.errors.minPrice?.message}>
            <Input {...register('minPrice')} {...money} />
          </Field>
          <Field label="Special / builder price" error={formState.errors.specialPrice?.message}>
            <Input {...register('specialPrice')} {...money} />
          </Field>
          <Field label="Tax %" error={formState.errors.taxRate?.message}>
            <Input {...register('taxRate')} {...money} />
          </Field>
          <Field label="Reorder level" error={formState.errors.reorderLevel?.message}>
            <Input {...register('reorderLevel')} {...money} />
          </Field>
          <Field label="Warranty">
            <Input {...register('warranty')} placeholder="e.g. 1 year" />
          </Field>
          <Field label="Description" className="sm:col-span-3">
            <Textarea rows={2} {...register('description')} />
          </Field>
          <Checkbox className="sm:col-span-3" {...register('isActive')} label="Active (available in quotations)" />
          <DialogFooter className="sm:col-span-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {product ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
