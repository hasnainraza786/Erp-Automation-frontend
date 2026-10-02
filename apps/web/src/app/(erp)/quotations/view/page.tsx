'use client';

import {
  downloadQuotationPdf,
  useApproveQuotation,
  useChangeQuotationStatus,
  useDuplicateQuotation,
  useGetQuotation,
  useSaveQuotationAsTemplate,
  useSendQuotation,
  type ChangeQuotationStatusDtoStatus,
} from '@erp/api-client';
import { fmtDate, humanize, P, qty, todayInput } from '@erp/core';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DescriptionList,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TFoot,
  TH,
  THead,
  TR,
  Textarea,
} from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, FileDown, Pencil, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { saveBlob } from '@/lib/files';
import { useIdParam } from '@/lib/hooks';
import { TERM_FIELDS } from '@/lib/quotation';

export default function QuotationViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: q, isLoading } = useGetQuotation(id, undefined, { query: { enabled: !!id } });
  const refresh = () => qc.invalidateQueries();
  const send = useSendQuotation({ mutation: { onSuccess: () => (toast.success('Quotation sent'), refresh()) } });
  const approve = useApproveQuotation({
    mutation: {
      onSuccess: (r) => {
        toast.success(`Project ${r.projectNumber} created`);
        setApproving(false);
        router.push(`/projects/view?id=${r.projectId}`);
      },
    },
  });
  const dup = useDuplicateQuotation({
    mutation: {
      onSuccess: (row) => {
        toast.success(`Duplicated as ${row.displayNumber}`);
        router.push(`/quotations/edit?id=${row.id}`);
      },
    },
  });
  const asTemplate = useSaveQuotationAsTemplate({ mutation: { onSuccess: () => (toast.success('Saved as template'), setTpl(false)) } });
  const status = useChangeQuotationStatus({ mutation: { onSuccess: () => (toast.success('Status updated'), setStatusOpen(false), refresh()) } });

  const [approving, setApproving] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');
  const [approvalDate, setApprovalDate] = useState(todayInput());
  const [projectName, setProjectName] = useState('');
  const [tpl, setTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ChangeQuotationStatusDtoStatus>('UNDER_DISCUSSION');

  if (isLoading) return <Loading />;
  if (!q) return <NotFound what="Quotation" />;
  const calc = q.calculation;
  const canSend = q.status === 'DRAFT';
  const canApprove = ['SENT', 'UNDER_DISCUSSION', 'REVISED'].includes(q.status);
  const canRevise = canApprove;
  const canEdit = q.editable;

  return (
    <>
      <PageHeader
        back="/quotations"
        title={q.displayNumber}
        badge={<StatusBadge status={q.status} />}
        description={
          <>
            <Link className="text-primary hover:underline" href={`/clients/view?id=${q.client.id}`}>
              {q.client.name}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" href={`/sites/view?id=${q.site.id}`}>
              {q.site.name}
            </Link>
            {q.projectId && (
              <>
                {' · '}
                <Link className="text-primary hover:underline" href={`/projects/view?id=${q.projectId}`}>
                  Project
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => saveBlob(() => downloadQuotationPdf(q.id), `${q.number}.pdf`, 'open')}>
              <FileDown /> PDF
            </Button>
            <Can permission={P.QUOTATION_MANAGE}>
              {canEdit && (
                <Button variant="outline" onClick={() => router.push(`/quotations/edit?id=${q.id}`)}>
                  <Pencil /> Edit
                </Button>
              )}
              {canRevise && (
                <Button variant="outline" onClick={() => router.push(`/quotations/edit?id=${q.id}`)}>
                  <Pencil /> Revise
                </Button>
              )}
              {canSend && (
                <Button onClick={() => send.mutate({ id: q.id })} loading={send.isPending}>
                  <Send /> Send
                </Button>
              )}
              <Button variant="outline" onClick={() => dup.mutate({ id: q.id, data: {} })}>
                <Copy /> Duplicate
              </Button>
              <Button variant="outline" onClick={() => (setTplName(`${q.site.name} template`), setTpl(true))}>
                Save as template
              </Button>
              {q.status !== 'APPROVED' && q.status !== 'CANCELLED' && (
                <Button variant="outline" onClick={() => setStatusOpen(true)}>
                  Change status
                </Button>
              )}
            </Can>
            {canApprove && (
              <Can permission={P.QUOTATION_APPROVE}>
                <Button onClick={() => setApproving(true)}>
                  <Check /> Approve
                </Button>
              </Can>
            )}
          </>
        }
      />

      <Card className="mb-6">
        <CardContent>
          <DescriptionList
            columns={4}
            items={[
              { label: 'Type', value: q.type === 'SITE_DIVISION' ? 'Site division' : 'Product-based' },
              { label: 'Date', value: fmtDate(q.revision.quotationDate) },
              { label: 'Valid until', value: fmtDate(q.revision.validUntil) },
              { label: 'Revision', value: `Rev ${q.currentRevisionNo}` },
              { label: 'Approved by', value: q.approvedBy },
              { label: 'Approved on', value: fmtDate(q.approvedAt) },
              { label: 'Notes', value: q.revision.notes, wide: true },
            ]}
          />
        </CardContent>
      </Card>

      {calc.spaces.map((space) => (
        <Card key={space.name} className="mb-4">
          <CardHeader title={space.name} description={`${space.itemCount} products · ${pkrSafe(space.subtotal)}`} />
          <ItemTable items={space.items} />
        </Card>
      ))}
      {calc.items.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="Products" />
          <ItemTable items={calc.items} />
        </Card>
      )}
      {calc.summary.length > 0 && q.type === 'SITE_DIVISION' && (
        <Card className="mb-4">
          <CardHeader title="Aggregated product summary" description="Used for procurement" />
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH align="right">Qty</TH>
                <TH align="right">Unit price</TH>
                <TH align="right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {calc.summary.map((s) => (
                <TR key={s.productId}>
                  <TD>
                    {s.name} <span className="text-xs text-muted-foreground">{s.sku}</span>
                  </TD>
                  <TD align="right">{qty(s.qty)}</TD>
                  <TD align="right">
                    <Money value={s.unitPrice} />
                  </TD>
                  <TD align="right">
                    <Money value={s.total} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Card className="mb-6">
        <Table>
          <TFoot>
            <TR>
              <TD className="text-right text-muted-foreground">Subtotal</TD>
              <TD align="right" className="w-40">
                <Money value={calc.subtotal} />
              </TD>
            </TR>
            {Number(calc.overallDiscount) > 0 && (
              <TR>
                <TD className="text-right text-muted-foreground">Discount</TD>
                <TD align="right">
                  − <Money value={calc.overallDiscount} />
                </TD>
              </TR>
            )}
            {Number(calc.taxTotal) > 0 && (
              <TR>
                <TD className="text-right text-muted-foreground">Tax</TD>
                <TD align="right">
                  <Money value={calc.taxTotal} />
                </TD>
              </TR>
            )}
            {calc.charges.map((c) => (
              <TR key={c.kind}>
                <TD className="text-right text-muted-foreground">{c.label || humanize(c.kind)}</TD>
                <TD align="right">
                  <Money value={c.amount} />
                </TD>
              </TR>
            ))}
            <TR>
              <TD className="text-right text-base">Grand total</TD>
              <TD align="right" className="text-base">
                <Money value={calc.grandTotal} />
              </TD>
            </TR>
          </TFoot>
        </Table>
        {calc.milestones.length > 0 && (
          <ul className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-2">
            {calc.milestones.map((m) => (
              <li key={m.name} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                <span>
                  {m.name} ({m.percent}%)
                </span>
                <Money value={m.amount} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader title="Terms" />
        <CardContent>
          <DescriptionList items={TERM_FIELDS.map(([key, label]) => ({ label, value: q.revision.terms[key] }))} />
        </CardContent>
      </Card>

      {q.revisions.length > 1 && (
        <Card className="mb-6">
          <CardHeader title="Revision history" />
          <Table>
            <THead>
              <TR>
                <TH>Rev</TH>
                <TH>Total</TH>
                <TH>Note</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {q.revisions.map((r) => (
                <TR key={r.id}>
                  <TD>Rev {r.revisionNo}</TD>
                  <TD>
                    <Money value={r.grandTotal} />
                  </TD>
                  <TD className="text-muted-foreground">{r.changeNote ?? '—'}</TD>
                  <TD>{fmtDate(r.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <DocumentsPanel ownerType="QUOTATION" ownerId={q.id} defaultCategory="SIGNED_QUOTATION" />

      <Dialog open={approving} onOpenChange={setApproving}>
        <DialogContent title="Approve quotation" description="Creates the project, receivable, milestones and stock reservations in one transaction.">
          <div className="space-y-3">
            <Field label="Approved by" required>
              <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Client representative" autoFocus />
            </Field>
            <Field label="Approval date">
              <Input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} />
            </Field>
            <Field label="Project name" hint="Defaults to the site name">
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(false)}>
              Cancel
            </Button>
            <Button
              loading={approve.isPending}
              disabled={approvedBy.trim().length < 2}
              onClick={() =>
                approve.mutate({
                  id: q.id,
                  data: { approvedBy: approvedBy.trim(), approvalDate, projectName: projectName || undefined, method: 'MANUAL' },
                })
              }
            >
              Approve and create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tpl} onOpenChange={setTpl}>
        <DialogContent title="Save as template" size="sm">
          <Field label="Template name" required>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTpl(false)}>
              Cancel
            </Button>
            <Button loading={asTemplate.isPending} disabled={tplName.trim().length < 2} onClick={() => asTemplate.mutate({ id: q.id, data: { name: tplName.trim() } })}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title="Change quotation status"
        confirmLabel="Update"
        loading={status.isPending}
        onConfirm={(note) => status.mutate({ id: q.id, data: { status: nextStatus, note: note || undefined } })}
      >
        <Field label="New status">
          <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ChangeQuotationStatusDtoStatus)}>
            <option value="UNDER_DISCUSSION">Under discussion</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
      </ConfirmDialog>
    </>
  );
}

function pkrSafe(v: string) {
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(v));
  } catch {
    return v;
  }
}

function ItemTable({ items }: { items: { productId: string; sku: string; name: string; qty: string; unitPrice: string; lineTotal: string; belowMinimum?: boolean }[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Product</TH>
          <TH align="right">Qty</TH>
          <TH align="right">Unit price</TH>
          <TH align="right">Line total</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((l, i) => (
          <TR key={`${l.productId}-${i}`}>
            <TD>
              {l.name} <span className="text-xs text-muted-foreground">{l.sku}</span>
              {l.belowMinimum && <span className="ml-2 text-xs text-red-600">below min</span>}
            </TD>
            <TD align="right">{qty(l.qty)}</TD>
            <TD align="right">
              <Money value={l.unitPrice} />
            </TD>
            <TD align="right">
              <Money value={l.lineTotal} />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
