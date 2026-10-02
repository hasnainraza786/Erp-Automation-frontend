'use client';

import {
  exportData,
  useGetPayablesAging,
  useGetPaymentsReport,
  useGetProductSales,
  useGetProjectProfitability,
  useGetReceivablesAging,
  useGetSalesReport,
  type GetProjectProfitabilityStatus,
  type GetSalesReportGroupBy,
} from '@erp/api-client';
import { fmtDate, humanize, qty } from '@erp/core';
import { Button, Card, CardHeader, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DataTable, ListCard, Money, PageHeader } from '@/components/page';
import { saveBlob } from '@/lib/files';
import { useQueryState } from '@/lib/hooks';

const AGING_COLS = [
  { key: 'current', header: 'Current' },
  { key: 'd0_30', header: '0–30' },
  { key: 'd31_60', header: '31–60' },
  { key: 'd61_90', header: '61–90' },
  { key: 'd90plus', header: '90+' },
  { key: 'total', header: 'Total' },
] as const;

export default function ReportsPage() {
  const [f, setF] = useQueryState({ tab: 'sales', dateFrom: '', dateTo: '', groupBy: 'month', status: 'ALL', page: 1 });
  const range = { dateFrom: f.dateFrom || undefined, dateTo: f.dateTo || undefined };
  const sales = useGetSalesReport({ ...range, groupBy: f.groupBy as GetSalesReportGroupBy }, { query: { enabled: f.tab === 'sales' } });
  const recv = useGetReceivablesAging({ query: { enabled: f.tab === 'receivables' } });
  const pay = useGetPayablesAging({ query: { enabled: f.tab === 'payables' } });
  const profit = useGetProjectProfitability({ status: f.status as GetProjectProfitabilityStatus, page: f.page, pageSize: 50 }, { query: { enabled: f.tab === 'profit' } });
  const products = useGetProductSales(range, { query: { enabled: f.tab === 'products' } });
  const payments = useGetPaymentsReport(range, { query: { enabled: f.tab === 'payments' } });

  const exportEntity: Record<string, string> = {
    sales: 'quotations',
    receivables: 'receivables-aging',
    payables: 'payables-aging',
    profit: 'project-profitability',
    products: 'product-sales',
    payments: 'payments',
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, aging, profitability and collections"
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" className="w-40" value={f.dateFrom} onChange={(e) => setF({ dateFrom: e.target.value })} aria-label="From" />
            <Input type="date" className="w-40" value={f.dateTo} onChange={(e) => setF({ dateTo: e.target.value })} aria-label="To" />
            <Button
              variant="outline"
              onClick={() => saveBlob(() => exportData(exportEntity[f.tab] ?? 'quotations', { format: 'xlsx', ...range }), `${f.tab}.xlsx`)}
            >
              <FileDown /> Excel
            </Button>
          </div>
        }
      />
      <Tabs value={f.tab} onValueChange={(tab) => setF({ tab, page: 1 })}>
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="payables">Payables</TabsTrigger>
          <TabsTrigger value="profit">Profitability</TabsTrigger>
          <TabsTrigger value="products">Product sales</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          {sales.data && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Conversion {sales.data.conversion.approved}/{sales.data.conversion.quotations} ({sales.data.conversion.rate}) · quoted <Money value={sales.data.conversion.quotedValue} /> · approved{' '}
                <Money value={sales.data.conversion.approvedValue} />
              </p>
              <ListCard
                toolbar={
                  <Select value={f.groupBy} onChange={(e) => setF({ groupBy: e.target.value })} className="w-44">
                    <option value="month">By month</option>
                    <option value="client">By client</option>
                    <option value="product">By product</option>
                    <option value="category">By category</option>
                  </Select>
                }
              >
                <DataTable
                  rows={sales.data.rows}
                  rowKey={(r) => r.key}
                  columns={[
                    { key: 'label', header: 'Group', cell: (r) => r.label },
                    { key: 'count', header: 'Count', align: 'right', cell: (r) => r.count },
                    { key: 'value', header: 'Value', align: 'right', cell: (r) => <Money value={r.value} /> },
                  ]}
                />
              </ListCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="receivables">
          <AgingTable data={recv.data} partyHref={(id) => `/clients/view?id=${id}`} />
        </TabsContent>
        <TabsContent value="payables">
          <AgingTable data={pay.data} partyHref={(id) => `/vendors/view?id=${id}`} />
        </TabsContent>

        <TabsContent value="profit">
          <ListCard
            toolbar={
              <Select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="w-44">
                <option value="ALL">All projects</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </Select>
            }
          >
            <ProfitTable data={profit.data} />
          </ListCard>
        </TabsContent>

        <TabsContent value="products">
          <ListCard>
            <DataTable
              rows={products.data}
              loading={products.isLoading}
              rowKey={(r) => r.productId}
              columns={[
                { key: 'sku', header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
                { key: 'name', header: 'Product', cell: (r) => <span className="font-medium">{r.name}</span> },
                { key: 'cat', header: 'Category', cell: (r) => r.category ?? '—' },
                { key: 'qty', header: 'Qty', align: 'right', cell: (r) => qty(r.qty) },
                { key: 'rev', header: 'Revenue', align: 'right', cell: (r) => <Money value={r.revenue} /> },
                { key: 'cost', header: 'Cost', align: 'right', cell: (r) => <Money value={r.cost} /> },
                { key: 'margin', header: 'Margin', align: 'right', cell: (r) => <Money value={r.margin} /> },
                { key: 'pct', header: '%', align: 'right', cell: (r) => `${r.marginPct}%` },
              ]}
            />
          </ListCard>
        </TabsContent>

        <TabsContent value="payments">
          {payments.data && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="By method" description={`${payments.data.count} payments · total`} />
                <DataTable
                  rows={payments.data.byMethod}
                  rowKey={(r) => r.method}
                  columns={[
                    { key: 'm', header: 'Method', cell: (r) => humanize(r.method) },
                    { key: 'c', header: 'Count', align: 'right', cell: (r) => r.count },
                    { key: 'a', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
                  ]}
                />
              </Card>
              <Card>
                <CardHeader title="By month" />
                <DataTable
                  rows={payments.data.byMonth}
                  rowKey={(r) => r.month}
                  columns={[
                    { key: 'm', header: 'Month', cell: (r) => r.month },
                    { key: 'c', header: 'Count', align: 'right', cell: (r) => r.count },
                    { key: 'a', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} /> },
                  ]}
                />
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function AgingTable({ data, partyHref }: { data?: { asOf: string; rows: { partyId: string; name: string; current: string; d0_30: string; d31_60: string; d61_90: string; d90plus: string; total: string }[]; totals: { current: string; d0_30: string; d31_60: string; d61_90: string; d90plus: string; total: string } }; partyHref: (id: string) => string }) {
  const router = useRouter();
  if (!data) return null;
  return (
    <ListCard>
      <p className="px-4 py-2 text-xs text-muted-foreground">As of {fmtDate(data.asOf)}</p>
      <DataTable
        rows={data.rows}
        rowKey={(r) => r.partyId}
        onRowClick={(r) => router.push(partyHref(r.partyId))}
        columns={[
          { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
          ...AGING_COLS.map((c) => ({ key: c.key, header: c.header, align: 'right' as const, cell: (r: (typeof data.rows)[number]) => <Money value={r[c.key]} /> })),
        ]}
        footer={
          <tfoot>
            <tr className="border-t bg-muted/40 font-medium">
              <td className="px-3 py-2.5">Totals</td>
              {AGING_COLS.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                  <Money value={data.totals[c.key]} />
                </td>
              ))}
            </tr>
          </tfoot>
        }
      />
    </ListCard>
  );
}

function ProfitTable({ data }: { data?: { rows: { projectId: string; number: string; name: string; client: string; status: string; contractValue: string; productCost: string; otherCosts: string; estimatedProfit: string; estimatedMargin: string; received: string }[]; totals: { contractValue: string; productCost: string; otherCosts: string; estimatedProfit: string; margin: string } } }) {
  const router = useRouter();
  return (
    <DataTable
      rows={data?.rows}
      rowKey={(r) => r.projectId}
      onRowClick={(r) => router.push(`/projects/view?id=${r.projectId}`)}
      columns={[
        { key: 'no', header: 'Project', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
        {
          key: 'name',
          header: 'Name',
          cell: (r) => (
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.client}</p>
            </div>
          ),
        },
        { key: 'status', header: 'Status', cell: (r) => humanize(r.status) },
        { key: 'value', header: 'Value', align: 'right', cell: (r) => <Money value={r.contractValue} /> },
        { key: 'cost', header: 'Product cost', align: 'right', cell: (r) => <Money value={r.productCost} /> },
        { key: 'other', header: 'Other costs', align: 'right', cell: (r) => <Money value={r.otherCosts} /> },
        { key: 'profit', header: 'Est. profit', align: 'right', cell: (r) => <Money value={r.estimatedProfit} /> },
        { key: 'm', header: 'Margin', align: 'right', cell: (r) => `${r.estimatedMargin}%` },
        { key: 'recv', header: 'Received', align: 'right', cell: (r) => <Money value={r.received} /> },
      ]}
    />
  );
}
