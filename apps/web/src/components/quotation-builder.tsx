'use client';

import {
  calculateQuotation,
  useCreateQuotation,
  useGetQuotation,
  useGetSettings,
  useListQuotationTemplates,
  useListSpacePresets,
  useReviseQuotation,
  useSendQuotation,
  useUpdateQuotation,
  type CalculateQuotationDto,
  type QuotationDetailDtoOutput,
  type QuotationDetailDtoOutputRevisionTerms,
} from '@erp/api-client';
import { humanize, P, pkr, qty, todayInput } from '@erp/core';
import { Button, Card, CardContent, CardHeader, Field, Input, Select, Table, TBody, TD, TFoot, TH, THead, TR, Textarea } from '@erp/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { SiteFormDialog } from '@/components/forms/site-form';
import { Loading, Money, NotFound, PageHeader, StatusBadge } from '@/components/page';
import { ClientPicker, ProductPicker, SitePicker } from '@/components/pickers';
import { useDebounced } from '@/lib/hooks';
import {
  CHARGE_KINDS,
  TERM_FIELDS,
  draftsFromQuotation,
  emptyLine,
  lineFromHit,
  toCalculatePayload,
  uid,
  type ChargeDraft,
  type DiscountType,
  type LineDraft,
  type QuoteType,
  type ScheduleDraft,
  type SpaceDraft,
} from '@/lib/quotation';

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function LineRows({
  items,
  onChange,
  canOverride,
  locked,
}: {
  items: LineDraft[];
  onChange: (items: LineDraft[]) => void;
  canOverride: boolean;
  locked: boolean;
}) {
  const patch = (i: number, p: Partial<LineDraft>) => onChange(items.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <Table>
      <THead>
        <TR>
          <TH>Product</TH>
          <TH align="right">Qty</TH>
          <TH align="right">Unit price</TH>
          <TH>Discount</TH>
          <TH align="right">Tax %</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {items.map((l, i) => (
          <TR key={l.key}>
            <TD>
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">
                {l.sku} · {humanize(l.unit)}
              </p>
            </TD>
            <TD>
              <Input className="w-20" value={l.qty} disabled={locked} onChange={(e) => patch(i, { qty: e.target.value })} />
            </TD>
            <TD>
              <Input className="w-28" value={l.unitPrice} disabled={locked || !canOverride} onChange={(e) => patch(i, { unitPrice: e.target.value })} />
            </TD>
            <TD>
              <div className="flex gap-1">
                <Select className="w-24" value={l.discountType} disabled={locked} onChange={(e) => patch(i, { discountType: e.target.value as DiscountType })}>
                  <option value="">None</option>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">PKR</option>
                </Select>
                <Input className="w-20" disabled={locked || !l.discountType} value={l.discountValue} onChange={(e) => patch(i, { discountValue: e.target.value })} />
              </div>
            </TD>
            <TD>
              <Input className="w-16" value={l.taxRate} disabled={locked} onChange={(e) => patch(i, { taxRate: e.target.value })} />
            </TD>
            <TD align="right">
              {!locked && (
                <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                  <Trash2 />
                </Button>
              )}
            </TD>
          </TR>
        ))}
        {items.length === 0 && (
          <TR>
            <TD colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
              Search a product above to add a line.
            </TD>
          </TR>
        )}
      </TBody>
    </Table>
  );
}

export function QuotationBuilder({ existing }: { existing?: QuotationDetailDtoOutput }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canOverride = can(P.PRODUCT_PRICE_OVERRIDE);
  const locked = existing ? !existing.editable : false;
  const reviseMode = !!existing && !existing.editable && ['SENT', 'UNDER_DISCUSSION', 'REVISED'].includes(existing.status);

  const { data: settings } = useGetSettings();
  const { data: templates } = useListQuotationTemplates({ query: { enabled: !existing } });
  const { data: presets } = useListSpacePresets();

  const [client, setClient] = useState<{ id: string; label: string } | null>(existing ? { id: existing.client.id, label: existing.client.name } : null);
  const [site, setSite] = useState<{ id: string; label: string } | null>(existing ? { id: existing.site.id, label: existing.site.name } : null);
  const [type, setType] = useState<QuoteType>(existing?.type ?? 'PRODUCT');
  const [templateId, setTemplateId] = useState('');
  const [items, setItems] = useState<LineDraft[]>(existing ? draftsFromQuotation(existing).items : []);
  const [spaces, setSpaces] = useState<SpaceDraft[]>(existing ? draftsFromQuotation(existing).spaces : [{ key: uid(), name: 'Living Room', items: [] }]);
  const [openSpaces, setOpenSpaces] = useState<Record<string, boolean>>({});
  const [overallDiscountType, setDiscType] = useState<DiscountType>(existing ? draftsFromQuotation(existing).overallDiscountType : '');
  const [overallDiscountValue, setDiscVal] = useState(existing ? draftsFromQuotation(existing).overallDiscountValue : '');
  const [charges, setCharges] = useState<ChargeDraft[]>(
    existing ? draftsFromQuotation(existing).charges : CHARGE_KINDS.map((kind) => ({ kind, label: '', amount: '' })),
  );
  const [schedule, setSchedule] = useState<ScheduleDraft[]>(existing ? draftsFromQuotation(existing).schedule : []);
  const [quotationDate, setDate] = useState(existing ? draftsFromQuotation(existing).quotationDate : todayInput());
  const [validUntil, setValid] = useState(existing ? draftsFromQuotation(existing).validUntil : '');
  const [notes, setNotes] = useState(existing ? draftsFromQuotation(existing).notes : '');
  const [terms, setTerms] = useState<QuotationDetailDtoOutputRevisionTerms>(existing ? draftsFromQuotation(existing).terms : {});
  const [newSite, setNewSite] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [sendAfter, setSendAfter] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  useEffect(() => {
    if (existing || !settings) return;
    if (!validUntil) setValid(addDays(todayInput(), settings.quotation.validityDays));
    if (!schedule.length) {
      const s = settings.quotation.defaultPaymentSchedule;
      setSchedule(s.length ? s.map((x) => ({ name: x.name, percent: String(x.percent) })) : [{ name: 'Advance', percent: '30' }, { name: 'Handover', percent: '70' }]);
    }
    if (!Object.keys(terms).length) setTerms(settings.quotation.defaultTerms ?? {});
  }, [existing, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const presetClientId = params.get('clientId');
  const presetSiteId = params.get('siteId');
  useEffect(() => {
    if (existing) return;
    if (presetClientId && !client) setClient({ id: presetClientId, label: 'Selected client' });
    if (presetSiteId && !site) setSite({ id: presetSiteId, label: 'Selected site' });
  }, [existing, presetClientId, presetSiteId, client, site]);

  const payload = useMemo(
    () => toCalculatePayload({ type, items, spaces, overallDiscountType, overallDiscountValue, charges, schedule }),
    [type, items, spaces, overallDiscountType, overallDiscountValue, charges, schedule],
  );
  const debounced = useDebounced(payload, 350);
  const hasLines = type === 'PRODUCT' ? items.some((l) => l.productId) : spaces.some((s) => s.items.some((l) => l.productId));
  const { data: calc } = useQuery({
    queryKey: ['quotations', 'calculate', debounced],
    queryFn: () => calculateQuotation(debounced as CalculateQuotationDto),
    enabled: hasLines,
    placeholderData: (prev) => prev,
    meta: { silent: true },
  });

  const content = useCallback(
    () => ({
      ...payload,
      quotationDate,
      validUntil: validUntil || null,
      terms,
      notes: notes || null,
    }),
    [payload, quotationDate, validUntil, terms, notes],
  );

  const create = useCreateQuotation();
  const update = useUpdateQuotation();
  const revise = useReviseQuotation();
  const send = useSendQuotation();

  const persist = async (andSend: boolean) => {
    if (!client || !site) return toast.error('Select a client and site');
    if (!hasLines) return toast.error('Add at least one product');
    const body = content();
    let saved: QuotationDetailDtoOutput;
    if (!existing) {
      saved = await create.mutateAsync({
        data: { ...body, clientId: client.id, siteId: site.id, templateId: templateId || undefined },
      });
    } else if (reviseMode) {
      if (changeNote.trim().length < 3) return toast.error('Describe what changed (at least 3 characters)');
      saved = await revise.mutateAsync({ id: existing.id, data: { ...body, version: existing.version, changeNote: changeNote.trim() } });
    } else {
      saved = await update.mutateAsync({ id: existing.id, data: { ...body, version: existing.version } });
    }
    if (andSend) {
      saved = await send.mutateAsync({ id: saved.id });
      toast.success(`${saved.displayNumber} sent`);
    } else {
      toast.success(existing ? `${saved.displayNumber} saved` : `${saved.displayNumber} created`);
    }
    qc.invalidateQueries();
    router.replace(`/quotations/view?id=${saved.id}`);
  };

  const busy = create.isPending || update.isPending || revise.isPending || send.isPending;
  const addProduct = (hit: Parameters<typeof lineFromHit>[0], spaceKey?: string) => {
    const line = lineFromHit(hit);
    if (type === 'PRODUCT') setItems((xs) => [...xs, line]);
    else if (spaceKey) setSpaces((xs) => xs.map((s) => (s.key === spaceKey ? { ...s, items: [...s.items, line] } : s)));
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates?.find((x) => x.id === id);
    if (!t) return;
    setType(t.type as QuoteType);
    if (t.type === 'SITE_DIVISION') {
      const grouped = new Map<string, LineDraft[]>();
      for (const it of t.items) {
        const name = it.spaceName || 'General';
        const list = grouped.get(name) ?? [];
        list.push(emptyLine({ productId: it.productId, sku: it.sku, name: it.productName, qty: it.qty }));
        grouped.set(name, list);
      }
      setSpaces([...grouped.entries()].map(([name, its]) => ({ key: uid(), name, items: its })));
      setItems([]);
    } else {
      setItems(t.items.map((it) => emptyLine({ productId: it.productId, sku: it.sku, name: it.productName, qty: it.qty })));
    }
  };

  const title = existing ? existing.displayNumber : 'New quotation';
  const editable = !locked || reviseMode;

  return (
    <>
      <PageHeader
        back="/quotations"
        title={title}
        badge={existing ? <StatusBadge status={existing.status} /> : undefined}
        description={existing ? `${existing.client.name} · ${existing.site.name}` : 'Client, site, products, then save or send'}
        actions={
          editable && (
            <Can permission={P.QUOTATION_MANAGE}>
              {reviseMode && (
                <Field className="w-64" label="Change note" required>
                  <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed?" />
                </Field>
              )}
              <Button variant="outline" loading={busy && !sendAfter} onClick={() => persist(false)}>
                <Save /> Save draft
              </Button>
              <Button
                loading={busy && sendAfter}
                onClick={() => {
                  setSendAfter(true);
                  setConfirmSend(true);
                }}
              >
                <Send /> Save & send
              </Button>
            </Can>
          )
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Field label="Client" required>
          <ClientPicker value={client?.id} label={client?.label} disabled={!!existing} onChange={(o) => (setClient(o), setSite(null))} />
        </Field>
        <Field
          label="Site"
          required
          hint={
            client && !existing ? (
              <button type="button" className="text-primary hover:underline" onClick={() => setNewSite(true)}>
                Create new site
              </button>
            ) : undefined
          }
        >
          <SitePicker clientId={client?.id} value={site?.id} label={site?.label} disabled={!!existing} onChange={setSite} />
        </Field>
        <Field label="Type">
          <Select value={type} disabled={!!existing && locked && !reviseMode} onChange={(e) => setType(e.target.value as QuoteType)}>
            <option value="PRODUCT">Product-based</option>
            <option value="SITE_DIVISION">Site division (by space)</option>
          </Select>
        </Field>
        {!existing && (
          <Field label="Template">
            <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">None</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Quotation date">
          <Input type="date" value={quotationDate} disabled={!editable} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Valid until">
          <Input type="date" value={validUntil} disabled={!editable} onChange={(e) => setValid(e.target.value)} />
        </Field>
      </div>

      {type === 'PRODUCT' ? (
        <Card className="mb-6">
          <CardHeader title="Products" actions={editable && <div className="w-80"><ProductPicker value={null} onPick={(p) => addProduct(p)} /></div>} />
          <LineRows items={items} onChange={setItems} canOverride={canOverride} locked={!editable} />
        </Card>
      ) : (
        <div className="mb-6 space-y-3">
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-56"
                value=""
                onChange={(e) => {
                  const name = e.target.value;
                  if (name) setSpaces((xs) => [...xs, { key: uid(), name, items: [] }]);
                }}
              >
                <option value="">Add a preset space…</option>
                {presets?.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="sm" onClick={() => setSpaces((xs) => [...xs, { key: uid(), name: 'Custom space', items: [] }])}>
                <Plus /> Custom space
              </Button>
            </div>
          )}
          {spaces.map((space) => {
            const open = openSpaces[space.key] !== false;
            return (
              <Card key={space.key}>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <button type="button" onClick={() => setOpenSpaces((s) => ({ ...s, [space.key]: !open }))} className="text-muted-foreground">
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <Input className="h-8 max-w-xs font-medium" value={space.name} disabled={!editable} onChange={(e) => setSpaces((xs) => xs.map((s) => (s.key === space.key ? { ...s, name: e.target.value } : s)))} />
                  <span className="text-xs text-muted-foreground">{space.items.length} products</span>
                  <div className="ml-auto flex items-center gap-2">
                    {editable && (
                      <div className="w-72">
                        <ProductPicker value={null} onPick={(p) => addProduct(p, space.key)} />
                      </div>
                    )}
                    {editable && (
                      <Button variant="ghost" size="icon-sm" aria-label="Remove space" onClick={() => setSpaces((xs) => xs.filter((s) => s.key !== space.key))}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
                {open && (
                  <LineRows
                    items={space.items}
                    onChange={(next) => setSpaces((xs) => xs.map((s) => (s.key === space.key ? { ...s, items: next } : s)))}
                    canOverride={canOverride}
                    locked={!editable}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Discounts & charges" />
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Overall discount">
                <Select value={overallDiscountType} disabled={!editable} onChange={(e) => setDiscType(e.target.value as DiscountType)}>
                  <option value="">None</option>
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed PKR</option>
                </Select>
              </Field>
              <Field label="Value">
                <Input value={overallDiscountValue} disabled={!editable || !overallDiscountType} onChange={(e) => setDiscVal(e.target.value)} />
              </Field>
            </div>
            {charges.map((c, i) => (
              <Field key={c.kind} label={humanize(c.kind)}>
                <Input
                  value={c.amount}
                  disabled={!editable}
                  onChange={(e) => setCharges((xs) => xs.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Payment schedule"
            actions={
              editable && (
                <Button variant="outline" size="sm" onClick={() => setSchedule((s) => [...s, { name: '', percent: '' }])}>
                  <Plus /> Milestone
                </Button>
              )
            }
          />
          <CardContent className="space-y-2">
            {schedule.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Name" value={s.name} disabled={!editable} onChange={(e) => setSchedule((xs) => xs.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} />
                <Input className="w-24" placeholder="%" value={s.percent} disabled={!editable} onChange={(e) => setSchedule((xs) => xs.map((x, idx) => (idx === i ? { ...x, percent: e.target.value } : x)))} />
                {editable && (
                  <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setSchedule((xs) => xs.filter((_, idx) => idx !== i))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Percentages should add up to 100. The server splits the grand total.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Totals" description="Calculated on the server — never trust the browser for money" />
        {calc ? (
          <>
            {calc.warnings.length > 0 && (
              <ul className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {calc.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {type === 'SITE_DIVISION' && calc.summary.length > 0 && (
              <div className="border-b border-border">
                <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product summary (all spaces)</p>
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
                        <TD align="right">{pkr(s.unitPrice)}</TD>
                        <TD align="right">{pkr(s.total)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            <Table>
              <TFoot>
                <TR>
                  <TD className="text-right text-muted-foreground">Subtotal</TD>
                  <TD align="right" className="w-40">
                    <Money value={calc.subtotal} />
                  </TD>
                </TR>
                {Number(calc.itemDiscountTotal) > 0 && (
                  <TR>
                    <TD className="text-right text-muted-foreground">Item discounts</TD>
                    <TD align="right">
                      − <Money value={calc.itemDiscountTotal} />
                    </TD>
                  </TR>
                )}
                {Number(calc.overallDiscount) > 0 && (
                  <TR>
                    <TD className="text-right text-muted-foreground">Overall discount</TD>
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
                {calc.estimatedProfit !== null && (
                  <TR>
                    <TD className="text-right text-muted-foreground">Est. profit</TD>
                    <TD align="right">
                      <Money value={calc.estimatedProfit} />
                    </TD>
                  </TR>
                )}
              </TFoot>
            </Table>
            {calc.milestones.length > 0 && (
              <ul className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-2">
                {calc.milestones.map((m) => (
                  <li key={m.name} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span>
                      {m.name} <span className="text-muted-foreground">({m.percent}%)</span>
                    </span>
                    <Money value={m.amount} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">Add products to see server-calculated totals.</p>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader title="Terms & notes" />
        <CardContent className="grid gap-3 md:grid-cols-2">
          {TERM_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Textarea rows={2} value={terms[key] ?? ''} disabled={!editable} onChange={(e) => setTerms((t) => ({ ...t, [key]: e.target.value }))} />
            </Field>
          ))}
          <Field label="Internal notes" className="md:col-span-2">
            <Textarea value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <SiteFormDialog
        open={newSite}
        onOpenChange={setNewSite}
        clientId={client?.id}
        clientName={client?.label}
        onSaved={(id) => setSite({ id, label: 'New site' })}
      />
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={(o) => {
          setConfirmSend(o);
          if (!o) setSendAfter(false);
        }}
        title="Send this quotation?"
        description="The current revision is frozen. Further edits create a new revision."
        confirmLabel="Save and send"
        loading={busy}
        onConfirm={() => persist(true)}
      />
    </>
  );
}

export function QuotationEditorPage() {
  const id = useSearchParams().get('id') ?? '';
  const { data, isLoading } = useGetQuotation(id, undefined, { query: { enabled: !!id } });
  if (!id) return <QuotationBuilder />;
  if (isLoading) return <Loading />;
  if (!data) return <NotFound what="Quotation" />;
  return <QuotationBuilder existing={data} />;
}
