'use client';

import { Badge, badgeVariants, Button, Card, EmptyState, Skeleton, Spinner, Table, TBody, TD, TH, THead, TR, cn } from '@erp/ui';
import { pkr } from '@erp/core';
import type { VariantProps } from 'class-variance-authority';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions, back, badge }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: string; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Back
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Money({ value, className, decimals, colorize }: { value: string | number | null | undefined; className?: string; decimals?: boolean; colorize?: boolean }) {
  const n = Number(value ?? 0);
  return <span className={cn('tabular-nums', colorize && n > 0 && 'text-red-600', colorize && n < 0 && 'text-emerald-600', className)}>{pkr(value, { decimals })}</span>;
}

type Tone = VariantProps<typeof badgeVariants>['tone'];
const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'gray', SENT: 'blue', UNDER_DISCUSSION: 'amber', REVISED: 'purple', APPROVED: 'green', REJECTED: 'red', EXPIRED: 'red', CANCELLED: 'red',
  ACTIVE: 'green', ARCHIVED: 'gray', LEAD: 'gray', QUOTATION: 'blue', IN_PROGRESS: 'amber', COMPLETED: 'green', ON_HOLD: 'amber',
  PROCUREMENT: 'purple', INSTALLATION: 'amber', TESTING: 'cyan',
  ISSUED: 'blue', PARTIALLY_PAID: 'amber', PAID: 'green', OVERDUE: 'red',
  POSTED: 'green', VOIDED: 'red', PENDING: 'gray', INVOICED: 'blue', PARTIALLY_RECEIVED: 'amber', RECEIVED: 'green',
  TODO: 'gray', DONE: 'green', BLOCKED: 'red',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return <Badge tone={STATUS_TONES[status] ?? 'gray'}>{status.replace(/_/g, ' ').toLowerCase()}</Badge>;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  onRowClick,
  empty,
  footer,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Table className={className}>
      <THead>
        <TR>
          {columns.map((c) => (
            <TH key={c.key} align={c.align} className={c.className}>
              {c.header}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {loading && !rows
          ? Array.from({ length: 5 }).map((_, i) => (
              <TR key={i}>
                {columns.map((c) => (
                  <TD key={c.key}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TD>
                ))}
              </TR>
            ))
          : rows?.map((row) => (
              <TR key={rowKey(row)} data-clickable={!!onRowClick} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <TD key={c.key} align={c.align} className={c.className}>
                    {c.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
        {!loading && rows && rows.length === 0 && (
          <tr>
            <td colSpan={columns.length}>{empty ?? <EmptyState />}</td>
          </tr>
        )}
      </TBody>
      {footer}
    </Table>
  );
}

export function Pagination({ meta, onPage }: { meta?: { page: number; totalPages: number; total: number; pageSize: number }; onPage: (p: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>
        {from}–{to} of {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function ListCard({ toolbar, children }: { toolbar?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">{toolbar}</div>}
      {children}
    </Card>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-20">
      <Spinner className="size-6" />
    </div>
  );
}

export function NotFound({ what = 'Record' }: { what?: string }) {
  return <EmptyState title={`${what} not found`} description="It may have been removed, or the link is incorrect." />;
}
