type Num = string | number | null | undefined;

const pkrFmt = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pkrFixed = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 });

/** "PKR 1,500,000" — amounts from the API are decimal strings. */
export function pkr(v: Num, opts: { decimals?: boolean; prefix?: boolean } = {}) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = (opts.decimals ? pkrFixed : pkrFmt).format(n);
  return opts.prefix === false ? s : `PKR ${s}`;
}

/** Compact amounts for KPI cards: "PKR 1.5M", "PKR 250K". */
export function pkrCompact(v: Num) {
  const n = Number(v ?? 0);
  const abs = Math.abs(n);
  const unit = abs >= 1e7 ? { d: 1e7, s: ' Cr' } : abs >= 1e5 ? { d: 1e5, s: ' Lac' } : abs >= 1e3 ? { d: 1e3, s: 'K' } : { d: 1, s: '' };
  return `PKR ${(n / unit.d).toLocaleString('en-PK', { maximumFractionDigits: unit.d === 1 ? 0 : 2 })}${unit.s}`;
}

export function qty(v: Num) {
  if (v === null || v === undefined || v === '') return '—';
  return qtyFmt.format(Number(v));
}

export function pct(v: Num) {
  if (v === null || v === undefined || v === '') return '—';
  return `${Number(v).toFixed(1)}%`;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '—';
  return dateFmt.format(new Date(v));
}

export function fmtDateTime(v: string | Date | null | undefined) {
  if (!v) return '—';
  return dateTimeFmt.format(new Date(v));
}

export function toDateInput(v: string | Date | null | undefined) {
  if (!v) return '';
  return new Date(v).toISOString().slice(0, 10);
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function relativeTime(v: string | Date) {
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(v);
}

export function humanize(v: string | null | undefined) {
  if (!v) return '—';
  return v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
