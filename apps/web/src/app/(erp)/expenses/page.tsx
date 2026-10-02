'use client';

import { useCreateExpense, useListExpenses, useVoidExpense, type ListExpensesCategory } from '@erp/api-client';
import { fmtDate, humanize, P, todayInput } from '@erp/core';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DataTable, ListCard, Money, PageHeader, Pagination, StatusBadge } from '@/components/page';
import { ProjectPicker, VendorPicker } from '@/components/pickers';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/forms';
import { useDebounced, useQueryState } from '@/lib/hooks';

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<{ id: string; number: string } | null>(null);
  const [f, setF] = useQueryState({ q: '', category: '', dateFrom: '', dateTo: '', page: 1 });
  const q = useDebounced(f.q);
  const { data, isLoading } = useListExpenses({
    q: q || undefined,
    category: (f.category || undefined) as ListExpensesCategory | undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    page: f.page,
    pageSize: 25,
  });
  const voidExp = useVoidExpense({ mutation: { onSuccess: () => (toast.success('Expense voided'), setVoiding(null), qc.invalidateQueries()) } });

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Business and project costs used in profitability"
        actions={
          <Can permission={P.EXPENSE_MANAGE}>
            <Button onClick={() => setCreating(true)}>
              <Plus /> Record expense
            </Button>
          </Can>
        }
      />
      <ListCard
        toolbar={
          <>
            <Input placeholder="Search…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-56" />
            <Select value={f.category} onChange={(e) => setF({ category: e.target.value })} className="w-48">
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
            <Input type="date" value={f.dateFrom} onChange={(e) => setF({ dateFrom: e.target.value })} className="w-40" aria-label="From" />
            <Input type="date" value={f.dateTo} onChange={(e) => setF({ dateTo: e.target.value })} className="w-40" aria-label="To" />
          </>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          columns={[
            { key: 'number', header: 'No.', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'date', header: 'Date', cell: (r) => fmtDate(r.expenseDate) },
            { key: 'cat', header: 'Category', cell: (r) => humanize(r.category) },
            { key: 'desc', header: 'Description', cell: (r) => r.description ?? r.payee ?? '—' },
            { key: 'project', header: 'Project', cell: (r) => (r.project ? `${r.project.number} ${r.project.name}` : '—') },
            { key: 'method', header: 'Method', cell: (r) => humanize(r.method) },
            { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'act',
              header: '',
              align: 'right',
              cell: (r) =>
                r.status === 'POSTED' ? (
                  <Can permission={P.EXPENSE_MANAGE}>
                    <Button variant="ghost" size="sm" onClick={() => setVoiding({ id: r.id, number: r.number })}>
                      Void
                    </Button>
                  </Can>
                ) : null,
            },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
      </ListCard>
      <ExpenseFormDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title={`Void expense ${voiding?.number}?`}
        description="Posts a reversing journal entry. The original remains in the audit trail."
        reasonLabel="Reason"
        confirmLabel="Void"
        destructive
        loading={voidExp.isPending}
        onConfirm={(reason) => voiding && voidExp.mutate({ id: voiding.id, data: { reason } })}
      />
    </>
  );
}

function ExpenseFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayInput());
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>('OTHER');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [vendor, setVendor] = useState<{ id: string; label: string } | null>(null);
  const [project, setProject] = useState<{ id: string; label: string } | null>(null);

  const create = useCreateExpense({
    mutation: {
      onSuccess: (e) => {
        toast.success(`Expense ${e.number} recorded`);
        qc.invalidateQueries();
        onOpenChange(false);
      },
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setDate(todayInput());
          setCategory('OTHER');
          setAmount('');
          setMethod('CASH');
          setDescription('');
          setPayee('');
          setNotes('');
          setVendor(null);
          setProject(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent title="Record expense">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Category" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (PKR)" required>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Paid by">
            <Select value={method} onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {humanize(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project" className="sm:col-span-2">
            <ProjectPicker value={project?.id} label={project?.label} onChange={setProject} clearable />
          </Field>
          <Field label="Vendor">
            <VendorPicker value={vendor?.id} label={vendor?.label} onChange={setVendor} clearable />
          </Field>
          <Field label="Payee">
            <Input value={payee} onChange={(e) => setPayee(e.target.value)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!amount}
            onClick={() =>
              create.mutate({
                data: {
                  expenseDate: date,
                  category,
                  amount,
                  method,
                  description: description || null,
                  payee: payee || null,
                  notes: notes || null,
                  vendorId: vendor?.id ?? null,
                  projectId: project?.id ?? null,
                },
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
