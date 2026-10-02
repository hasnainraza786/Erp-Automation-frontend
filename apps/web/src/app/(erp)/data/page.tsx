'use client';

import { downloadImportTemplate, exportData, useImportData } from '@erp/api-client';
import { humanize } from '@erp/core';
import { Button, Card, CardContent, CardHeader, Field, Input, Select } from '@erp/ui';
import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page';
import { saveBlob } from '@/lib/files';

const IMPORTS = ['clients', 'products', 'vendors'] as const;
const EXPORTS = [
  'clients',
  'sites',
  'products',
  'vendors',
  'quotations',
  'projects',
  'invoices',
  'payments',
  'expenses',
  'purchase-orders',
  'stock',
  'receivables-aging',
  'payables-aging',
  'product-sales',
  'project-profitability',
] as const;

export default function DataPage() {
  const [entity, setEntity] = useState<(typeof IMPORTS)[number]>('clients');
  const [exportEntity, setExport] = useState<(typeof EXPORTS)[number]>('clients');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const imp = useImportData();

  const runImport = async (file: File | undefined, dryRun: boolean) => {
    if (!file) return;
    const res = await imp.mutateAsync({ entity, data: { file }, params: { dryRun: dryRun ? 'true' : 'false' } });
    const summary = `${res.dryRun ? 'Dry run' : 'Imported'}: ${res.totalRows} rows, ${res.created} created, ${res.updated} updated, ${res.errors.length} errors`;
    setResult(summary + (res.errors.length ? '\n' + res.errors.slice(0, 10).map((e) => `Row ${e.row}: ${e.message}`).join('\n') : ''));
    toast[res.errors.length ? 'error' : 'success'](summary);
  };

  return (
    <>
      <PageHeader title="Import / export" description="CSV and Excel for masters, plus operational reports" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Import" description="Download the template, fill it, then dry-run before committing." />
          <CardContent className="space-y-3">
            <Field label="Entity">
              <Select value={entity} onChange={(e) => setEntity(e.target.value as (typeof IMPORTS)[number])}>
                {IMPORTS.map((e) => (
                  <option key={e} value={e}>
                    {humanize(e)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => saveBlob(() => downloadImportTemplate(entity), `${entity}-template.xlsx`)}>
                <Download /> Template
              </Button>
              <label className="inline-flex">
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => runImport(e.target.files?.[0], true)} />
                <Button variant="outline" type="button" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()} loading={imp.isPending}>
                  Dry run
                </Button>
              </label>
              <label className="inline-flex">
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => runImport(e.target.files?.[0], false)} />
                <Button type="button" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()} loading={imp.isPending}>
                  <Upload /> Import
                </Button>
              </label>
            </div>
            {result && <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{result}</pre>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Export" />
          <CardContent className="space-y-3">
            <Field label="Dataset">
              <Select value={exportEntity} onChange={(e) => setExport(e.target.value as (typeof EXPORTS)[number])}>
                {EXPORTS.map((e) => (
                  <option key={e} value={e}>
                    {humanize(e.replace(/-/g, ' '))}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input type="date" value={dateFrom} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={dateTo} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            <Field label="Format">
              <Select value={format} onChange={(e) => setFormat(e.target.value as 'xlsx' | 'csv')}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </Select>
            </Field>
            <Button onClick={() => saveBlob(() => exportData(exportEntity, { format, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }), `${exportEntity}.${format}`)}>
              <Download /> Download
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
