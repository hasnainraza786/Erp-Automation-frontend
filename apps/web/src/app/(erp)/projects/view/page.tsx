'use client';

import {
  useAddDefaultProjectTasks,
  useCreateProjectTask,
  useCreatePurchaseOrdersFromShortage,
  useDeliverProjectItem,
  useGetProject,
  useGetProjectProcurement,
  useInstallProjectItem,
  useListUsers,
  useReserveProjectStock,
  useUpdatePaymentMilestone,
  useUpdateProjectProgress,
  useUpdateProjectStatus,
  useUpdateProjectTask,
  type UpdateProjectStatusDtoStatus,
  type UpdateTaskDtoStatus,
} from '@erp/api-client';
import { humanize, P, qty } from '@erp/core';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Progress,
  Select,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { HandCoins, Receipt, ShoppingCart, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { InvoiceFormDialog } from '@/components/forms/invoice-form';
import { LedgerView } from '@/components/ledger-view';
import { Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { PROJECT_STATUSES } from '@/lib/forms';
import { useIdParam } from '@/lib/hooks';

const STAGES = ['quotation', 'approval', 'procurement', 'delivery', 'installation', 'programming', 'testing', 'handover'] as const;
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;

export default function ProjectViewPage() {
  const id = useIdParam();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: p, isLoading } = useGetProject(id, { query: { enabled: !!id } });
  const procurement = useGetProjectProcurement(id, { query: { enabled: !!id && can(P.PURCHASE_VIEW) } });
  const users = useListUsers({ query: { enabled: can(P.PROJECT_MANAGE) || can(P.PROJECT_PROGRESS) } });
  const refresh = () => qc.invalidateQueries();

  const statusMut = useUpdateProjectStatus({ mutation: { onSuccess: () => (toast.success('Status updated'), refresh()) } });
  const progressMut = useUpdateProjectProgress({ mutation: { onSuccess: () => toast.success('Progress saved') } });
  const install = useInstallProjectItem({ mutation: { onSuccess: () => (toast.success('Installed qty updated'), refresh()) } });
  const deliver = useDeliverProjectItem({ mutation: { onSuccess: () => (toast.success('Delivery recorded'), setDelivering(null), refresh()) } });
  const reserve = useReserveProjectStock({ mutation: { onSuccess: () => (toast.success('Available stock reserved'), refresh()) } });
  const fromShortage = useCreatePurchaseOrdersFromShortage({
    mutation: {
      onSuccess: (pos) => {
        toast.success(`${pos.length} draft purchase order${pos.length === 1 ? '' : 's'} created`);
        setShortage(false);
        refresh();
        if (pos[0]) router.push(`/purchase-orders/view?id=${pos[0].id}`);
      },
    },
  });
  const addDefaults = useAddDefaultProjectTasks({ mutation: { onSuccess: () => (toast.success('Default tasks added'), refresh()) } });
  const createTask = useCreateProjectTask({ mutation: { onSuccess: () => (toast.success('Task added'), setTaskName(''), refresh()) } });
  const updateTask = useUpdateProjectTask({ mutation: { onSuccess: refresh } });
  const updateMs = useUpdatePaymentMilestone({ mutation: { onSuccess: refresh } });

  const [status, setStatus] = useState('');
  const [invoice, setInvoice] = useState<{ project: { id: string; label: string }; milestoneId?: string } | null>(null);
  const [delivering, setDelivering] = useState<{ id: string; name: string; max: number } | null>(null);
  const [deliverQty, setDeliverQty] = useState('');
  const [shortage, setShortage] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [taskName, setTaskName] = useState('');
  const [progress, setProgress] = useState<Record<string, number> | null>(null);

  const stages = progress ?? p?.progress ?? {};
  const shortLines = useMemo(() => (procurement.data ?? []).filter((l) => Number(l.toPurchase) > 0), [procurement.data]);

  if (isLoading) return <Loading />;
  if (!p) return <NotFound what="Project" />;
  const f = p.financials;

  return (
    <>
      <PageHeader
        back="/projects"
        title={`${p.number} · ${p.name}`}
        badge={<StatusBadge status={p.status} />}
        description={
          <>
            <Link className="text-primary hover:underline" href={`/clients/view?id=${p.client.id}`}>
              {p.client.name}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" href={`/sites/view?id=${p.site.id}`}>
              {p.site.name}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" href={`/quotations/view?id=${p.quotation.id}`}>
              {p.quotation.number}
            </Link>
          </>
        }
        actions={
          <>
            <Can permission={P.PROJECT_MANAGE}>
              <Select
                className="w-44"
                value={status || p.status}
                onChange={(e) => {
                  const next = e.target.value as UpdateProjectStatusDtoStatus;
                  setStatus(next);
                  statusMut.mutate({ id: p.id, data: { status: next, version: p.version } });
                }}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </Can>
            <Can permission={P.PAYMENT_CREATE}>
              <Button variant="outline" onClick={() => router.push(`/payments/new?clientId=${p.client.id}`)}>
                <HandCoins /> Record payment
              </Button>
            </Can>
            <Can permission={P.INVOICE_MANAGE}>
              <Button onClick={() => setInvoice({ project: { id: p.id, label: `${p.number} · ${p.name}` } })}>
                <Receipt /> Invoice
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Contract value" value={<Money value={p.contractValue} />} />
        <Stat label="Received" value={<Money value={p.received} />} tone="green" />
        <Stat label="Outstanding" value={<Money value={p.outstanding} />} tone={Number(p.outstanding) > 0 ? 'red' : 'default'} />
        <Stat label="Est. cost" value={<Money value={f.estimatedCost} />} />
        <Stat label="Est. profit" value={<Money value={f.estimatedProfit} />} hint={`${f.estimatedMargin}%`} tone="blue" />
        <Stat label="Progress" value={`${Math.round(p.overallProgress)}%`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          {can(P.PURCHASE_VIEW) && <TabsTrigger value="procurement">Procurement</TabsTrigger>}
          <TabsTrigger value="installation">Installation</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {can(P.LEDGER_VIEW) && <TabsTrigger value="ledger">Ledger</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="mb-6">
            <CardHeader
              title="Stage progress"
              actions={
                can(P.PROJECT_PROGRESS) && (
                  <Button
                    size="sm"
                    onClick={() =>
                      progressMut.mutate({
                        id: p.id,
                        data: { progress: Object.fromEntries(STAGES.map((s) => [s, Number(stages[s]) || 0])) },
                      })
                    }
                    loading={progressMut.isPending}
                  >
                    Save progress
                  </Button>
                )
              }
            />
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STAGES.map((s) => {
                const v = Number((stages as Record<string, number>)[s]) || 0;
                return (
                  <Field key={s} label={humanize(s)}>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={v}
                        disabled={!can(P.PROJECT_PROGRESS)}
                        onChange={(e) =>
                          setProgress({
                            ...Object.fromEntries(STAGES.map((k) => [k, Number(p.progress[k]) || 0])),
                            ...(progress ?? {}),
                            [s]: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <span className="w-10 text-right text-xs tabular-nums">{v}%</span>
                    </div>
                    <Progress value={v} className="mt-1" />
                  </Field>
                );
              })}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Stat label="Actual product cost" value={<Money value={f.actualProductCost} />} />
            <Stat label="Project expenses" value={<Money value={f.expenses} />} />
            <Stat label="Actual profit" value={<Money value={f.actualProfit} />} hint={`${f.actualMargin}%`} />
            <Stat label="Invoiced" value={<Money value={f.invoiced} />} />
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Required</TH>
                  <TH align="right">Purchased</TH>
                  <TH align="right">Received</TH>
                  <TH align="right">Delivered</TH>
                  <TH align="right">Installed</TH>
                  <TH align="right">Remaining</TH>
                </TR>
              </THead>
              <TBody>
                {p.items.map((it) => (
                  <TR key={it.id}>
                    <TD>
                      <p className="font-medium">{it.name}</p>
                      <p className="text-xs text-muted-foreground">{it.sku}</p>
                    </TD>
                    <TD align="right">{qty(it.requiredQty)}</TD>
                    <TD align="right">{qty(it.purchasedQty)}</TD>
                    <TD align="right">{qty(it.receivedQty)}</TD>
                    <TD align="right">{qty(it.deliveredQty)}</TD>
                    <TD align="right">{qty(it.installedQty)}</TD>
                    <TD align="right">{qty(it.remainingQty)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="procurement">
          <Card>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border p-3">
              <Can permission={P.INVENTORY_MANAGE}>
                <Button variant="outline" size="sm" onClick={() => reserve.mutate({ id: p.id })} loading={reserve.isPending}>
                  <Warehouse /> Reserve available stock
                </Button>
              </Can>
              <Can permission={P.PURCHASE_MANAGE}>
                <Button size="sm" disabled={!shortLines.length} onClick={() => (setPicked(shortLines.map((l) => l.productId)), setShortage(true))}>
                  <ShoppingCart /> Draft POs from shortage
                </Button>
              </Can>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Supplier</TH>
                  <TH align="right">Required</TH>
                  <TH align="right">Available</TH>
                  <TH align="right">On order</TH>
                  <TH align="right">To purchase</TH>
                </TR>
              </THead>
              <TBody>
                {(procurement.data ?? []).map((l) => (
                  <TR key={l.projectItemId}>
                    <TD>
                      {l.name} <span className="text-xs text-muted-foreground">{l.sku}</span>
                    </TD>
                    <TD>{l.supplierName ?? '—'}</TD>
                    <TD align="right">{qty(l.required)}</TD>
                    <TD align="right">{qty(l.availableStock)}</TD>
                    <TD align="right">{qty(l.onOrder)}</TD>
                    <TD align="right" className={Number(l.toPurchase) > 0 ? 'font-semibold text-amber-600' : ''}>
                      {qty(l.toPurchase)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="installation">
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Received</TH>
                  <TH align="right">Delivered</TH>
                  <TH align="right">Installed</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {p.items.map((it) => (
                  <TR key={it.id}>
                    <TD>{it.name}</TD>
                    <TD align="right">{qty(it.receivedQty)}</TD>
                    <TD align="right">{qty(it.deliveredQty)}</TD>
                    <TD>
                      <Input
                        className="ml-auto w-24"
                        defaultValue={it.installedQty}
                        disabled={!can(P.PROJECT_PROGRESS)}
                        onBlur={(e) => {
                          if (e.target.value !== it.installedQty) install.mutate({ id: p.id, itemId: it.id, data: { installedQty: e.target.value } });
                        }}
                      />
                    </TD>
                    <TD align="right">
                      <Can permission={P.PROJECT_PROGRESS}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Number(it.receivedQty) - Number(it.deliveredQty) <= 0}
                          onClick={() => {
                            setDelivering({ id: it.id, name: it.name, max: Number(it.receivedQty) - Number(it.deliveredQty) });
                            setDeliverQty(String(Number(it.receivedQty) - Number(it.deliveredQty)));
                          }}
                        >
                          Deliver
                        </Button>
                      </Can>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Milestone</TH>
                  <TH align="right">%</TH>
                  <TH align="right">Amount</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {p.milestones.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.name}</TD>
                    <TD align="right">{m.percent}</TD>
                    <TD align="right">
                      <Money value={m.amount} />
                    </TD>
                    <TD>
                      <Input
                        type="date"
                        className="w-40"
                        defaultValue={m.dueDate?.slice(0, 10) ?? ''}
                        disabled={!can(P.PROJECT_MANAGE)}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== (m.dueDate?.slice(0, 10) ?? '')) updateMs.mutate({ milestoneId: m.id, data: { dueDate: v } });
                        }}
                      />
                    </TD>
                    <TD>
                      <StatusBadge status={m.status} />
                    </TD>
                    <TD align="right">
                      {m.invoiceId ? (
                        <Link href={`/invoices/view?id=${m.invoiceId}`} className="text-xs text-primary hover:underline">
                          {m.invoiceNumber}
                        </Link>
                      ) : (
                        <Can permission={P.INVOICE_MANAGE}>
                          <Button size="sm" variant="outline" onClick={() => setInvoice({ project: { id: p.id, label: `${p.number} · ${p.name}` }, milestoneId: m.id })}>
                            Bill
                          </Button>
                        </Can>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
              <Can permission={P.PROJECT_PROGRESS}>
                <Field label="New task" className="w-64">
                  <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Task name" />
                </Field>
                <Button
                  size="sm"
                  disabled={taskName.trim().length < 2}
                  onClick={() => createTask.mutate({ id: p.id, data: { name: taskName.trim() } })}
                  loading={createTask.isPending}
                >
                  Add
                </Button>
                {!p.tasks.length && (
                  <Button variant="outline" size="sm" onClick={() => addDefaults.mutate({ id: p.id })}>
                    Add default checklist
                  </Button>
                )}
              </Can>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Task</TH>
                  <TH>Assignee</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {p.tasks.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD>
                      {can(P.PROJECT_PROGRESS) ? (
                        <Select
                          className="w-44"
                          value={t.assigneeId ?? ''}
                          onChange={(e) => updateTask.mutate({ taskId: t.id, data: { assigneeId: e.target.value || null } })}
                        >
                          <option value="">Unassigned</option>
                          {users.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        t.assigneeName ?? '—'
                      )}
                    </TD>
                    <TD>
                      <Input
                        type="date"
                        className="w-40"
                        defaultValue={t.dueDate?.slice(0, 10) ?? ''}
                        disabled={!can(P.PROJECT_PROGRESS)}
                        onBlur={(e) => updateTask.mutate({ taskId: t.id, data: { dueDate: e.target.value || null } })}
                      />
                    </TD>
                    <TD>
                      <Select
                        className="w-40"
                        value={t.status}
                        disabled={!can(P.PROJECT_PROGRESS)}
                        onChange={(e) => updateTask.mutate({ taskId: t.id, data: { status: e.target.value as UpdateTaskDtoStatus } })}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {humanize(s)}
                          </option>
                        ))}
                      </Select>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerView party="client" id={p.client.id} projectId={p.id} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel
            ownerType="PROJECT"
            ownerId={p.id}
            defaultCategory="SITE_PHOTO"
            categories={['SITE_PHOTO', 'DRAWING', 'FLOOR_PLAN', 'SIGNED_QUOTATION', 'HANDOVER', 'OTHER']}
          />
        </TabsContent>
      </Tabs>

      {invoice && <InvoiceFormDialog open onOpenChange={(o) => !o && setInvoice(null)} project={invoice.project} milestoneId={invoice.milestoneId} />}

      <Dialog open={!!delivering} onOpenChange={(o) => !o && setDelivering(null)}>
        <DialogContent title={`Deliver ${delivering?.name ?? ''}`} size="sm">
          <Field label="Quantity" hint={`Max ${delivering?.max ?? 0}`}>
            <Input value={deliverQty} onChange={(e) => setDeliverQty(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelivering(null)}>
              Cancel
            </Button>
            <Button
              loading={deliver.isPending}
              onClick={() => delivering && deliver.mutate({ id: p.id, itemId: delivering.id, data: { qty: deliverQty } })}
            >
              Record delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={shortage}
        onOpenChange={setShortage}
        title="Create purchase orders from shortage"
        description={`${shortLines.length} products need purchasing. Draft POs are grouped by default supplier.`}
        confirmLabel="Create drafts"
        loading={fromShortage.isPending}
        onConfirm={() => fromShortage.mutate({ data: { projectId: p.id, productIds: picked.length ? picked : undefined } })}
      />
    </>
  );
}
