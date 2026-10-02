import { cva, type VariantProps } from 'class-variance-authority';
import { Inbox, Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from './utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-xs', className)} {...props} />;
}

export function CardHeader({ className, title, description, actions, children }: { className?: string; title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-3.5', className)}>
      <div className="min-w-0">
        {title && <h3 className="text-sm font-semibold">{title}</h3>}
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      purple: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
      cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    },
  },
  defaultVariants: { tone: 'gray' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function EmptyState({ title = 'Nothing here yet', description, action, icon }: { title?: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: 'default' | 'green' | 'red' | 'amber' | 'blue'; className?: string }) {
  const toneCls = { default: 'text-foreground', green: 'text-emerald-600', red: 'text-red-600', amber: 'text-amber-600', blue: 'text-blue-600' }[tone ?? 'default'];
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-xl font-semibold tabular-nums', toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function DescriptionList({ items, columns = 2, className }: { items: { label: string; value: React.ReactNode; wide?: boolean }[]; columns?: 1 | 2 | 3 | 4; className?: string }) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns];
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', cols, className)}>
      {items.map((i) => (
        <div key={i.label} className={cn('min-w-0', i.wide && 'sm:col-span-full')}>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{i.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all', v >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${v}%` }} />
    </div>
  );
}
