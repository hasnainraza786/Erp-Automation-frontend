'use client';

import { getListClientsQueryKey, useCreateClient, useUpdateClient, type ClientDetailDtoOutput } from '@erp/api-client';
import { humanize } from '@erp/core';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { applyServerErrors, clean, CLIENT_TYPES } from '@/lib/forms';

type Values = {
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  cnicNtn: string;
  billingAddress: string;
  type: (typeof CLIENT_TYPES)[number];
  notes: string;
};

const empty: Values = { name: '', companyName: '', contactPerson: '', phone: '', whatsapp: '', email: '', cnicNtn: '', billingAddress: '', type: 'RESIDENTIAL', notes: '' };

export function ClientFormDialog({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; client?: ClientDetailDtoOutput; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const form = useForm<Values>({ defaultValues: empty });
  const { register, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (open) reset(client ? (Object.fromEntries(Object.keys(empty).map((k) => [k, (client as unknown as Record<string, unknown>)[k] ?? ''])) as Values) : empty);
  }, [open, client, reset]);

  const opts = {
    mutation: {
      meta: { silent: true },
      onSuccess: (c: { id: string }) => {
        toast.success(client ? 'Client updated' : 'Client created');
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        qc.invalidateQueries({ queryKey: [`/api/v1/clients/${c.id}`] });
        onOpenChange(false);
        onSaved?.(c.id);
      },
      onError: (e: unknown) => {
        if (!applyServerErrors(e, setError, Object.keys(empty))) toast.error((e as Error).message);
      },
    },
  };
  const create = useCreateClient(opts);
  const update = useUpdateClient(opts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={client ? `Edit ${client.name}` : 'New client'} size="lg">
        <form
          onSubmit={handleSubmit((v) => (client ? update.mutate({ id: client.id, data: clean(v, 'update') }) : create.mutate({ data: clean(v) })))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Client name" required error={formState.errors.name?.message}>
            <Input {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} autoFocus />
          </Field>
          <Field label="Type">
            <Select {...register('type')}>
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Company name" error={formState.errors.companyName?.message}>
            <Input {...register('companyName')} />
          </Field>
          <Field label="Contact person">
            <Input {...register('contactPerson')} />
          </Field>
          <Field label="Phone" error={formState.errors.phone?.message}>
            <Input {...register('phone')} inputMode="tel" />
          </Field>
          <Field label="WhatsApp">
            <Input {...register('whatsapp')} inputMode="tel" />
          </Field>
          <Field label="Email" error={formState.errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="CNIC / NTN">
            <Input {...register('cnicNtn')} />
          </Field>
          <Field label="Billing address" className="sm:col-span-2">
            <Textarea rows={2} {...register('billingAddress')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {client ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
