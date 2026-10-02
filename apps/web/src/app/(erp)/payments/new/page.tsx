'use client';

import { useCreatePayment, useGetClient, useGetClientOpenItems } from '@erp/api-client';
import { humanize, pkr, todayInput } from '@erp/core';
import { Button, Card, CardContent, CardHeader, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AllocationEditor, allocatedTotal, allocationsFrom, type AllocationDraft } from '@/components/allocation-editor';
import { PageHeader } from '@/components/page';
import { ClientPicker } from '@/components/pickers';
import { PAYMENT_METHODS } from '@/lib/forms';

export default function NewPaymentPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const presetId = params.get('clientId') ?? '';
  const preset = useGetClient(presetId, { query: { enabled: !!presetId } });
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const [paidOn, setPaidOn] = useState(todayInput());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [transactionId, setTxn] = useState('');
  const [notes, setNotes] = useState('');
  const [alloc, setAlloc] = useState<AllocationDraft>({});

  useEffect(() => {
    if (preset.data && !client) setClient({ id: preset.data.id, label: preset.data.name });
  }, [preset.data, client]);

  const openItems = useGetClientOpenItems(client?.id ?? '', { query: { enabled: !!client } });
  const amountN = Number(amount) || 0;
  const allocated = allocatedTotal(alloc);

  const create = useCreatePayment({
    mutation: {
      onSuccess: (p) => {
        toast.success(`Receipt ${p.number} recorded`);
        qc.invalidateQueries();
        router.push(`/payments/view?id=${p.id}`);
      },
    },
  });

  const save = () => {
    if (!client) return toast.error('Select a client');
    if (amountN <= 0) return toast.error('Enter the amount received');
    if (allocated > amountN) return toast.error('Allocations exceed the amount received');
    create.mutate({
      data: {
        clientId: client.id,
        paidOn,
        amount,
        method,
        reference: reference || null,
        bank: bank || null,
        chequeNo: chequeNo || null,
        transactionId: transactionId || null,
        notes: notes || null,
        allocations: allocationsFrom(alloc),
      },
    });
  };

  return (
    <>
      <PageHeader back="/payments" title="Record payment" description="Receive money from a client and allocate it to one or more projects" />
      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Client" required className="sm:col-span-2">
              <ClientPicker
                value={client?.id}
                label={client?.label}
                onChange={(o) => {
                  setClient(o);
                  setAlloc({});
                }}
              />
            </Field>
            <Field label="Date received" required>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            <Field label="Amount (PKR)" required>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-right text-base font-medium" />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {humanize(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            {(method === 'BANK_TRANSFER' || method === 'CHEQUE' || method === 'ONLINE_TRANSFER') && (
              <Field label="Bank">
                <Input value={bank} onChange={(e) => setBank(e.target.value)} />
              </Field>
            )}
            {method === 'CHEQUE' && (
              <Field label="Cheque no.">
                <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
              </Field>
            )}
            {(method === 'BANK_TRANSFER' || method === 'ONLINE_TRANSFER' || method === 'CARD') && (
              <Field label="Transaction ID">
                <Input value={transactionId} onChange={(e) => setTxn(e.target.value)} />
              </Field>
            )}
            <Field label="Notes" className="sm:col-span-3">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        {client && (
          <Card>
            <CardHeader
              title="Allocate to projects"
              description={
                openItems.data?.unallocatedPayments.length
                  ? `This client also has ${openItems.data.unallocatedPayments.length} earlier receipt(s) with unallocated money — allocate those from the receipt page.`
                  : 'Anything not allocated is kept as an advance and can be allocated later.'
              }
            />
            <CardContent>
              <AllocationEditor items={openItems.data} available={amountN} value={alloc} onChange={setAlloc} />
            </CardContent>
          </Card>
        )}
        <div className="flex items-center justify-end gap-3">
          {amountN > 0 && <span className="text-sm text-muted-foreground">Advance after save: {pkr(Math.max(0, amountN - allocated))}</span>}
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending}>
            Save receipt
          </Button>
        </div>
      </div>
    </>
  );
}
