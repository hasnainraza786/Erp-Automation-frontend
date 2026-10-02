'use client';

import { useCreateInvoice, useGetProject } from '@erp/api-client';
import { pkr, todayInput } from '@erp/core';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Select, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProjectPicker } from '@/components/pickers';

type Kind = 'MILESTONE' | 'BALANCE' | 'ADDITIONAL';
interface Line {
  description: string;
  qty: string;
  unitPrice: string;
}

/** Create a milestone, balance, or additional-work invoice for a project. */
export function InvoiceFormDialog({ open, onOpenChange, project: fixed, milestoneId: presetMilestone }: { open: boolean; onOpenChange: (o: boolean) => void; project?: { id: string; label: string }; milestoneId?: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [project, setProject] = useState<{ id: string; label: string } | null>(fixed ?? null);
  const [kind, setKind] = useState<Kind>(presetMilestone ? 'MILESTONE' : 'ADDITIONAL');
  const [milestoneId, setMilestone] = useState(presetMilestone ?? '');
  const [invoiceDate, setDate] = useState(todayInput());
  const [dueDate, setDue] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: '1', unitPrice: '' }]);
  const [discount, setDiscount] = useState('');
  const [taxRate, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [issue, setIssue] = useState(true);

  useEffect(() => {
    if (!open) return;
    setProject(fixed ?? null);
    setKind(presetMilestone ? 'MILESTONE' : 'ADDITIONAL');
    setMilestone(presetMilestone ?? '');
    setDate(todayInput());
    setDue('');
    setLines([{ description: '', qty: '1', unitPrice: '' }]);
    setDiscount('');
    setTax('');
    setNotes('');
    setIssue(true);
  }, [open, fixed, presetMilestone]);

  const detail = useGetProject(project?.id ?? '', { query: { enabled: open && !!project } });
  const pending = detail.data?.milestones.filter((m) => !m.invoiceId) ?? [];
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const net = subtotal - (Number(discount) || 0);
  const total = net + (net * (Number(taxRate) || 0)) / 100;

  const create = useCreateInvoice({
    mutation: {
      onSuccess: (inv) => {
        toast.success(`Invoice ${inv.number} ${inv.status === 'DRAFT' ? 'saved as draft' : 'issued'}`);
        qc.invalidateQueries();
        onOpenChange(false);
        router.push(`/invoices/view?id=${inv.id}`);
      },
    },
  });

  const save = () => {
    if (!project) return toast.error('Select a project');
    if (kind === 'MILESTONE' && !milestoneId) return toast.error('Select the milestone to bill');
    const items = kind === 'ADDITIONAL' ? lines.filter((l) => l.description.trim() && Number(l.unitPrice) > 0) : undefined;
    if (kind === 'ADDITIONAL' && !items?.length) return toast.error('Add at least one line with a price');
    create.mutate({
      data: {
        projectId: project.id,
        kind,
        milestoneId: kind === 'MILESTONE' ? milestoneId : undefined,
        invoiceDate,
        dueDate: dueDate || null,
        items: items?.map((l) => ({ description: l.description.trim(), qty: l.qty || '1', unitPrice: l.unitPrice })),
        discount: kind === 'ADDITIONAL' ? discount || '0' : undefined,
        taxRate: kind === 'ADDITIONAL' ? taxRate || '0' : undefined,
        notes: notes || null,
        issue,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New invoice" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" required className="sm:col-span-2">
            <ProjectPicker value={project?.id} label={project?.label} onChange={setProject} disabled={!!fixed} />
          </Field>
          <Field label="Invoice type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="MILESTONE">Milestone (from payment schedule)</option>
              <option value="BALANCE">Remaining contract balance</option>
              <option value="ADDITIONAL">Additional work / extras</option>
            </Select>
          </Field>
          {kind === 'MILESTONE' ? (
            <Field label="Milestone" required>
              <Select value={milestoneId} onChange={(e) => setMilestone(e.target.value)} disabled={!pending.length}>
                <option value="">{pending.length ? 'Select…' : 'No un-invoiced milestones'}</option>
                {pending.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {Number(m.percent)}% · {pkr(m.amount)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Invoice date">
            <Input type="date" value={invoiceDate} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
          </Field>
          {kind === 'ADDITIONAL' && (
            <div className="space-y-2 sm:col-span-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  <Input className="w-20 text-right" inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} aria-label="Qty" />
                  <Input className="w-36 text-right" inputMode="decimal" placeholder="Unit price" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line">
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: '', qty: '1', unitPrice: '' }])}>
                  <Plus /> Line
                </Button>
                <div className="ml-auto flex items-center gap-2 text-sm">
                  Discount <Input className="h-8 w-28 text-right" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
                  Tax % <Input className="h-8 w-20 text-right" inputMode="decimal" value={taxRate} onChange={(e) => setTax(e.target.value)} placeholder="0" />
                  <strong className="tabular-nums">{pkr(total)}</strong>
                </div>
              </div>
            </div>
          )}
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Checkbox checked={issue} onChange={(e) => setIssue(e.target.checked)} label="Issue immediately (otherwise save as draft)" className="sm:col-span-2" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending}>
            {issue ? 'Create & issue' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
