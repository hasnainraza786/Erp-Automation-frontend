'use client';

import { useGetAccountsDashboard } from '@erp/api-client';
import { fmtDate, pkrCompact } from '@erp/core';
import { Card, CardHeader, Stat } from '@erp/ui';
import { Banknote, Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DataTable, Loading, Money, PageHeader } from '@/components/page';

export default function AccountsPage() {
  const { data } = useGetAccountsDashboard();
  if (!data) {
    return (
      <>
        <PageHeader title="Accounts" description="Cash, bank, receivables and payables" />
        <Loading />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Accounts" description={`Position for ${data.month}`} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cash" value={pkrCompact(data.cash)} icon={<Banknote />} />
        <Stat label="Bank" value={pkrCompact(data.bank)} icon={<Landmark />} tone="blue" />
        <Stat label="Receivables" value={pkrCompact(data.receivables)} icon={<TrendingUp />} tone="amber" />
        <Stat label="Payables" value={pkrCompact(data.payables)} icon={<TrendingDown />} tone="red" />
        <Stat label="Net position" value={pkrCompact(data.netPosition)} icon={<Wallet />} />
        <Stat label="Collections this month" value={pkrCompact(data.monthlyCollections)} tone="green" />
        <Stat label="Purchases this month" value={pkrCompact(data.monthlyPurchases)} />
        <Stat label="Expenses this month" value={pkrCompact(data.monthlyExpenses)} />
      </div>
      <Stat label="Profit estimate (month)" value={<Money value={data.profitEstimate} />} className="mb-6" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top overdue clients" actions={<Link href="/reports?tab=receivables" className="text-xs text-primary hover:underline">Aging</Link>} />
          <DataTable
            rows={data.topOverdueClients}
            rowKey={(r) => r.clientId}
            columns={[
              {
                key: 'name',
                header: 'Client',
                cell: (r) => (
                  <Link href={`/clients/view?id=${r.clientId}`} className="font-medium hover:text-primary">
                    {r.name}
                  </Link>
                ),
              },
              { key: 'overdue', header: 'Overdue', align: 'right', cell: (r) => <Money value={r.overdue} colorize /> },
              { key: 'out', header: 'Outstanding', align: 'right', cell: (r) => <Money value={r.outstanding} /> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Upcoming client payments" />
          <DataTable
            rows={data.upcomingClientPayments}
            rowKey={(r) => r.milestoneId}
            columns={[
              {
                key: 'who',
                header: 'Milestone',
                cell: (r) => (
                  <Link href={`/projects/view?id=${r.projectId}`} className="hover:text-primary">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.projectNumber} · {r.clientName}
                    </span>
                  </Link>
                ),
              },
              { key: 'due', header: 'Due', cell: (r) => fmtDate(r.dueDate) },
              { key: 'amt', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Upcoming vendor payments" />
          <DataTable
            rows={data.upcomingVendorPayments}
            rowKey={(r) => r.poId}
            columns={[
              {
                key: 'po',
                header: 'PO',
                cell: (r) => (
                  <Link href={`/purchase-orders/view?id=${r.poId}`} className="hover:text-primary">
                    <span className="block font-medium">{r.number}</span>
                    <span className="text-xs text-muted-foreground">{r.vendorName}</span>
                  </Link>
                ),
              },
              { key: 'due', header: 'Due', cell: (r) => fmtDate(r.dueDate) },
              { key: 'amt', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
