'use client';

import { getListVendorsQueryKey, useCreateVendor, useUpdateVendor, type VendorDtoOutput } from '@erp/api-client';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { applyServerErrors, clean } from '@/lib/forms';

type Values = { name: string; contactPerson: string; phone: string; email: string; address: string; taxInfo: string; paymentTerms: string; creditLimit: string; notes: string };
const empty: Values = { name: '', contactPerson: '', phone: '', email: '', address: '', taxInfo: '', paymentTerms: '', creditLimit: '', notes: '' };

export function VendorFormDialog({ open, onOpenChange, vendor, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; vendor?: VendorDtoOutput; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ defaultValues: empty });

  useEffect(() => {
    if (open) reset(vendor ? (Object.fromEntries(Object.keys(empty).map((k) => [k, (vendor as unknown as Record<string, unknown>)[k] ?? ''])) as Values) : empty);
  }, [open, vendor, reset]);

  const opts = {
    mutation: {
      meta: { silent: true },
      onSuccess: (v: { id: string }) => {
        toast.success(vendor ? 'Vendor updated' : 'Vendor created');
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: [`/api/v1/vendors/${v.id}`] });
        onOpenChange(false);
        onSaved?.(v.id);
      },
      onError: (e: unknown) => {
        if (!applyServerErrors(e, setError, Object.keys(empty))) toast.error((e as Error).message);
      },
    },
  };
  const create = useCreateVendor(opts);
  const update = useUpdateVendor(opts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={vendor ? `Edit ${vendor.name}` : 'New vendor'} size="lg">
        <form onSubmit={handleSubmit((v) => (vendor ? update.mutate({ id: vendor.id, data: clean(v, 'update') }) : create.mutate({ data: clean(v) as never })))} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor name" required error={formState.errors.name?.message} className="sm:col-span-2">
            <Input {...register('name', { required: 'Name is required' })} autoFocus />
          </Field>
          <Field label="Contact person">
            <Input {...register('contactPerson')} />
          </Field>
          <Field label="Phone" error={formState.errors.phone?.message}>
            <Input {...register('phone')} inputMode="tel" />
          </Field>
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="NTN / STRN">
            <Input {...register('taxInfo')} />
          </Field>
          <Field label="Payment terms" hint="e.g. 30 days, advance, on delivery">
            <Input {...register('paymentTerms')} />
          </Field>
          <Field label="Credit limit (PKR)" error={formState.errors.creditLimit?.message}>
            <Input {...register('creditLimit')} inputMode="decimal" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} {...register('address')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {vendor ? 'Save changes' : 'Create vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
