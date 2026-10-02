'use client';

import { useGetDashboard } from '@erp/api-client';
import { pkr, pkrCompact, relativeTime } from '@erp/core';
import { Card, CardContent, CardHeader, Input, Stat } from '@erp/ui';
import { AlertTriangle, BadgeDollarSign, Briefcase, CircleDollarSign, FileText, HandCoins, TrendingUp, Truck } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loading, PageHeader } from '@/components/page';
import { useQueryState } from '@/lib/hooks';
import { entityHref } from '@/lib/nav';

export default function DashboardPage() {
  const [range, setRange] = useQueryState({ dateFrom: '', dateTo: '' });
  const { data } = useGetDashboard({ dateFrom: range.dateFrom || undefined, dateTo: range.dateTo || undefined });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Sales, collections and outstanding balances at a glance"
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Input type="date" className="w-40" value={range.dateFrom} onChange={(e) => setRange({ dateFrom: e.target.value })} aria-label="From" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" className="w-40" value={range.dateTo} onChange={(e) => setRange({ dateTo: e.target.value })} aria-label="To" />
          </div>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total sales" value={pkrCompact(data.kpis.totalSales)} hint={`${data.kpis.approvedProjects} approved projects`} icon={<TrendingUp />} />
            <Stat label="Quotation value" value={pkrCompact(data.kpis.quotationValue)} icon={<FileText />} />
            <Stat label="Amount received" value={pkrCompact(data.kpis.amountReceived)} icon={<HandCoins />} tone="green" />
            <Stat label="Gross profit (est.)" value={data.kpis.grossProfit === null ? '—' : pkrCompact(data.kpis.grossProfit)} icon={<BadgeDollarSign />} tone="blue" />
            <Stat label="Receivables" value={pkrCompact(data.kpis.receivables)} hint={`${pkr(data.receivables.overdue)} overdue`} icon={<CircleDollarSign />} tone="amber" />
            <Stat label="Payables" value={pkrCompact(data.kpis.payables)} hint={`${pkr(data.payables.overdue)} overdue`} icon={<Truck />} tone="red" />
            <Stat label="Active projects" value={data.kpis.activeProjects} icon={<Briefcase />} />
            <Stat label="Due this month" value={pkrCompact(data.receivables.dueThisMonth)} hint="Client milestones" icon={<AlertTriangle />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Sales overview" description="Last 12 months" />
              <CardContent className="h-80 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.salesOverview.map((p) => ({ month: p.month.slice(2), Quoted: Number(p.quotationValue), Approved: Number(p.approvedValue), Collected: Number(p.collected) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => pkrCompact(v).replace('PKR ', '')} width={60} />
                    <Tooltip formatter={(v) => pkr(v as number)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Quoted" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Approved" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Collected" fill="#059669" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Recent activity" />
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {data.recentActivity.length === 0 && <li className="p-5 text-sm text-muted-foreground">No activity yet.</li>}
                {data.recentActivity.map((a) => {
                  const href = entityHref(a.entityType, a.entityId);
                  const body = (
                    <>
                      <p className="text-sm">{a.summary ?? a.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.actorName ?? 'System'} · {relativeTime(a.createdAt)}
                      </p>
                    </>
                  );
                  return (
                    <li key={a.id} className="px-5 py-2.5">
                      {href ? (
                        <Link href={href} className="block hover:text-primary">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Receivables" actions={<Link href="/reports?tab=receivables" className="text-xs text-primary hover:underline">Aging report</Link>} />
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total outstanding</p>
                  <p className="mt-1 font-semibold tabular-nums">{pkr(data.receivables.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="mt-1 font-semibold tabular-nums text-red-600">{pkr(data.receivables.overdue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due this month</p>
                  <p className="mt-1 font-semibold tabular-nums text-amber-600">{pkr(data.receivables.dueThisMonth)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Payables" actions={<Link href="/reports?tab=payables" className="text-xs text-primary hover:underline">Aging report</Link>} />
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total to vendors</p>
                  <p className="mt-1 font-semibold tabular-nums">{pkr(data.payables.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="mt-1 font-semibold tabular-nums text-red-600">{pkr(data.payables.overdue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
