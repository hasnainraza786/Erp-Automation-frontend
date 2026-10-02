'use client';

import { useCreateVendorPayment } from '@erp/api-client';
import { humanize, pkr, todayInput } from '@erp/core';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { VendorPicker } from '@/components/pickers';
import { applyServerErrors, clean, PAYMENT_METHODS } from '@/lib/forms';

type Values = { vendorId: string; paidOn: string; amount: string; method: (typeof PAYMENT_METHODS)[number]; reference: string; notes: string };

export function VendorPaymentDialog({
  open,
  onOpenChange,
  vendor,
  outstanding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendor?: { id: string; name: string };
  outstanding?: string;
}) {
  const qc = useQueryClient();
  const [vendorName, setVendorName] = useState<string>();
  const { register, handleSubmit, reset, setError, formState, control } = useForm<Values>();

  useEffect(() => {
    if (!open) return;
    setVendorName(vendor?.name);
    reset({ vendorId: vendor?.id ?? '', paidOn: todayInput(), amount: '', method: 'BANK_TRANSFER', reference: '', notes: '' });
  }, [open, vendor, reset]);

  const create = useCreateVendorPayment({
    mutation: {
      meta: { silent: true },
      onSuccess: (p) => {
        toast.success(`Payment ${p.number} recorded`);
        qc.invalidateQueries();
        onOpenChange(false);
      },
      onError: (e) => {
        if (!applyServerErrors(e, setError, ['vendorId', 'paidOn', 'amount', 'method', 'reference', 'notes'])) toast.error((e as Error).message);
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Pay vendor" description={outstanding ? `Payable balance ${pkr(outstanding)}` : undefined}>
        <form onSubmit={handleSubmit((v) => create.mutate({ data: clean(v) as never }))} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor" required error={formState.errors.vendorId?.message} className="sm:col-span-2">
            <Controller
              control={control}
              name="vendorId"
              rules={{ required: 'Select a vendor' }}
              render={({ field }) => (
                <VendorPicker
                  value={field.value || null}
                  label={vendorName}
                  disabled={!!vendor}
                  onChange={(o) => {
                    setVendorName(o?.label);
                    field.onChange(o?.id ?? '');
                  }}
                />
              )}
            />
          </Field>
          <Field label="Date" required error={formState.errors.paidOn?.message}>
            <Input type="date" {...register('paidOn', { required: true })} />
          </Field>
          <Field label="Amount (PKR)" required error={formState.errors.amount?.message}>
            <Input {...register('amount', { required: 'Enter an amount', validate: (v) => Number(v) > 0 || 'Must be greater than zero' })} inputMode="decimal" autoFocus />
          </Field>
          <Field label="Method">
            <Select {...register('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {humanize(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference / cheque no.">
            <Input {...register('reference')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
