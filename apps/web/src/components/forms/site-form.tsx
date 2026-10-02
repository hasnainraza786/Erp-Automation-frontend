'use client';

import { getListSitesQueryKey, useCreateSite, useListUsers, useUpdateSite, type SiteDtoOutput } from '@erp/api-client';
import { humanize, P, toDateInput } from '@erp/core';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth';
import { ClientPicker } from '@/components/pickers';
import { applyServerErrors, clean, SITE_STATUSES, SITE_TYPES } from '@/lib/forms';

type Values = {
  name: string;
  address: string;
  type: (typeof SITE_TYPES)[number];
  status: (typeof SITE_STATUSES)[number];
  managerId: string;
  startDate: string;
  expectedCompletion: string;
  notes: string;
};

export function SiteFormDialog({
  open,
  onOpenChange,
  site,
  clientId: fixedClientId,
  clientName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  site?: SiteDtoOutput;
  clientId?: string;
  clientName?: string;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const users = useListUsers({ query: { enabled: open && can(P.USER_MANAGE) } });
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>();

  useEffect(() => {
    if (!open) return;
    setClient(fixedClientId ? { id: fixedClientId, label: clientName ?? '' } : site ? { id: site.clientId, label: site.client.name } : null);
    reset({
      name: site?.name ?? '',
      address: site?.address ?? '',
      type: (site?.type as Values['type']) ?? 'HOUSE',
      status: (site?.status as Values['status']) ?? 'LEAD',
      managerId: site?.managerId ?? '',
      startDate: toDateInput(site?.startDate),
      expectedCompletion: toDateInput(site?.expectedCompletion),
      notes: site?.notes ?? '',
    });
  }, [open, site, fixedClientId, clientName, reset]);

  const opts = {
    mutation: {
      meta: { silent: true },
      onSuccess: (s: { id: string }) => {
        toast.success(site ? 'Site updated' : 'Site created');
        qc.invalidateQueries({ queryKey: getListSitesQueryKey() });
        qc.invalidateQueries({ queryKey: [`/api/v1/sites/${s.id}`] });
        if (client) qc.invalidateQueries({ queryKey: [`/api/v1/clients/${client.id}`] });
        onOpenChange(false);
        onSaved?.(s.id);
      },
      onError: (e: unknown) => {
        if (!applyServerErrors(e, setError, ['name', 'address', 'type', 'status', 'startDate', 'expectedCompletion'])) toast.error((e as Error).message);
      },
    },
  };
  const create = useCreateSite(opts);
  const update = useUpdateSite(opts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={site ? `Edit ${site.name}` : 'New site'} size="lg">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((v) => {
            if (site) return update.mutate({ id: site.id, data: clean(v, 'update') });
            if (!client) return toast.error('Select a client');
            create.mutate({ data: { ...clean(v), clientId: client.id } });
          })}
        >
          <Field label="Client" required className="sm:col-span-2">
            <ClientPicker value={client?.id} label={client?.label} onChange={(o) => setClient(o)} disabled={!!fixedClientId || !!site} />
          </Field>
          <Field label="Site name" required error={formState.errors.name?.message}>
            <Input {...register('name', { required: 'Required' })} placeholder="e.g. DHA Phase 6 House" />
          </Field>
          <Field label="Type">
            <Select {...register('type')}>
              {SITE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} {...register('address')} />
          </Field>
          <Field label="Status">
            <Select {...register('status')}>
              {SITE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project manager">
            <Select {...register('managerId')}>
              <option value="">—</option>
              {site?.manager && !users.data && <option value={site.manager.id}>{site.manager.name}</option>}
              {users.data?.filter((u) => u.isActive).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.name})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" error={formState.errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="Expected completion">
            <Input type="date" {...register('expectedCompletion')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {site ? 'Save changes' : 'Create site'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
