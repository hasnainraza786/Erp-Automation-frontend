import type {
  CalculateQuotationDto,
  CreateQuotationDtoChargesItemKind,
  ProductSearchResultDtoOutputItem,
  QuotationDetailDtoOutput,
  QuotationDetailDtoOutputCalculationItemsItem,
  QuotationDetailDtoOutputRevisionTerms,
} from '@erp/api-client';

export type QuoteType = 'PRODUCT' | 'SITE_DIVISION';
export type DiscountType = 'PERCENT' | 'FIXED' | '';
export type ChargeKind = CreateQuotationDtoChargesItemKind;

export const CHARGE_KINDS: ChargeKind[] = ['INSTALLATION', 'PROGRAMMING', 'ENGINEERING', 'TRANSPORTATION', 'OTHER'];
export const TERM_FIELDS = [
  ['paymentTerms', 'Payment terms'],
  ['validity', 'Validity'],
  ['warranty', 'Warranty'],
  ['installation', 'Installation'],
  ['availability', 'Availability'],
  ['delivery', 'Delivery'],
  ['exclusions', 'Exclusions'],
  ['taxes', 'Taxes'],
  ['cancellation', 'Cancellation'],
] as const;

let seq = 0;
export function uid() {
  return `k${Date.now().toString(36)}${(++seq).toString(36)}`;
}

export interface LineDraft {
  key: string;
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qty: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxRate: string;
  description: string;
}

export interface SpaceDraft {
  key: string;
  name: string;
  items: LineDraft[];
}

export interface ChargeDraft {
  kind: ChargeKind;
  label: string;
  amount: string;
}

export interface ScheduleDraft {
  name: string;
  percent: string;
}

export function emptyLine(p?: Partial<LineDraft>): LineDraft {
  return {
    key: uid(),
    productId: '',
    sku: '',
    name: '',
    unit: 'PIECE',
    qty: '1',
    unitPrice: '',
    discountType: '',
    discountValue: '',
    taxRate: '',
    description: '',
    ...p,
  };
}

export function lineFromHit(p: ProductSearchResultDtoOutputItem): LineDraft {
  return emptyLine({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    unitPrice: p.sellingPrice,
    taxRate: p.taxRate,
  });
}

export function lineFromCalc(l: QuotationDetailDtoOutputCalculationItemsItem): LineDraft {
  return emptyLine({
    productId: l.productId,
    sku: l.sku,
    name: l.name,
    unit: l.unit,
    qty: String(Number(l.qty)),
    unitPrice: l.unitPrice,
    discountType: (l.discountType as DiscountType) ?? '',
    discountValue: Number(l.discountValue) ? l.discountValue : '',
    taxRate: l.taxRate,
    description: l.description ?? '',
  });
}

export function serializeLine(l: LineDraft) {
  return {
    productId: l.productId,
    qty: l.qty || '1',
    unitPrice: l.unitPrice || undefined,
    discountType: (l.discountType || null) as 'PERCENT' | 'FIXED' | null,
    discountValue: l.discountValue || null,
    taxRate: l.taxRate || null,
    description: l.description || null,
  };
}

export function toCalculatePayload(input: {
  type: QuoteType;
  items: LineDraft[];
  spaces: SpaceDraft[];
  overallDiscountType: DiscountType;
  overallDiscountValue: string;
  charges: ChargeDraft[];
  schedule: ScheduleDraft[];
}): CalculateQuotationDto {
  const lines = (xs: LineDraft[]) => xs.filter((l) => l.productId).map(serializeLine);
  return {
    type: input.type,
    items: input.type === 'PRODUCT' ? lines(input.items) : undefined,
    spaces: input.type === 'SITE_DIVISION' ? input.spaces.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), items: lines(s.items) })) : undefined,
    overallDiscountType: (input.overallDiscountType || null) as 'PERCENT' | 'FIXED' | null,
    overallDiscountValue: input.overallDiscountValue || null,
    charges: input.charges.filter((c) => Number(c.amount) > 0).map((c) => ({ kind: c.kind, label: c.label || null, amount: c.amount })),
    paymentSchedule: input.schedule.filter((s) => s.name.trim() && Number(s.percent) > 0).map((s) => ({ name: s.name.trim(), percent: s.percent })),
  };
}

export function draftsFromQuotation(q: QuotationDetailDtoOutput) {
  const calc = q.calculation;
  const items = calc.items.map(lineFromCalc);
  const spaces: SpaceDraft[] =
    calc.spaces.length > 0
      ? calc.spaces.map((s) => ({ key: uid(), name: s.name, items: s.items.map(lineFromCalc) }))
      : [{ key: uid(), name: 'Living Room', items: [] }];
  const charges: ChargeDraft[] = CHARGE_KINDS.map((kind) => {
    const found = calc.charges.find((c) => c.kind === kind);
    return { kind, label: found?.label && found.label !== kind ? found.label : '', amount: found ? found.amount : '' };
  });
  const schedule: ScheduleDraft[] = q.revision.paymentSchedule.map((s) => ({ name: s.name, percent: String(s.percent) }));
  return {
    type: q.type as QuoteType,
    items: items.length ? items : [],
    spaces,
    overallDiscountType: (q.revision.overallDiscountType as DiscountType) ?? '',
    overallDiscountValue: Number(q.revision.overallDiscountValue) ? q.revision.overallDiscountValue : '',
    charges,
    schedule: schedule.length ? schedule : [{ name: 'Advance', percent: '30' }, { name: 'Handover', percent: '70' }],
    quotationDate: q.revision.quotationDate.slice(0, 10),
    validUntil: q.revision.validUntil?.slice(0, 10) ?? '',
    notes: q.revision.notes ?? '',
    terms: { ...q.revision.terms } as QuotationDetailDtoOutputRevisionTerms,
  };
}
