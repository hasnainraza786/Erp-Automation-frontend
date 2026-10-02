'use client';

import { downloadClientStatement, downloadVendorStatement, useGetClientLedger, useGetVendorLedger, type LedgerDtoOutput } from '@erp/api-client';
import { fmtDate, humanize } from '@erp/core';
import { Button, Card, Input, Table, TBody, TD, TFoot, TH, THead, TR } from '@erp/ui';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { Loading, Money } from '@/components/page';
import { saveBlob } from '@/lib/files';

function LedgerTable({ data, partyLabel }: { data: LedgerDtoOutput; partyLabel: 'client' | 'vendor' }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Reference</TH>
          <TH>Description</TH>
          {partyLabel === 'client' && <TH>Site / project</TH>}
          <TH align="right">{partyLabel === 'client' ? 'Debit (billed)' : 'Purchases'}</TH>
          <TH align="right">{partyLabel === 'client' ? 'Credit (received)' : 'Payments'}</TH>
          <TH align="right">Balance</TH>
        </TR>
      </THead>
      <TBody>
        <TR className="bg-muted/30">
          <TD colSpan={partyLabel === 'client' ? 4 : 3} className="text-xs font-medium text-muted-foreground">
            Opening balance
          </TD>
          <TD />
          <TD />
          <TD align="right" className="font-medium">
            <Money value={data.openingBalance} />
          </TD>
        </TR>
        {data.entries.map((e) => (
          <TR key={e.entryId}>
            <TD className="whitespace-nowrap">{fmtDate(e.date)}</TD>
            <TD className="whitespace-nowrap font-mono text-xs">{e.reference ?? e.entryNumber}</TD>
            <TD>
              <span className="block">{e.description}</span>
              <span className="text-xs text-muted-foreground">{humanize(e.sourceType)}</span>
            </TD>
            {partyLabel === 'client' && <TD className="text-xs text-muted-foreground">{[e.site, e.project].filter(Boolean).join(' · ') || '—'}</TD>}
            <TD align="right">{Number(e.debit) ? <Money value={e.debit} /> : ''}</TD>
            <TD align="right">{Number(e.credit) ? <Money value={e.credit} /> : ''}</TD>
            <TD align="right" className="font-medium">
              <Money value={e.balance} />
            </TD>
          </TR>
        ))}
        {data.entries.length === 0 && (
          <TR>
            <TD colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
              No transactions in this period.
            </TD>
          </TR>
        )}
      </TBody>
      <TFoot>
        <TR>
          <TD colSpan={partyLabel === 'client' ? 4 : 3}>Closing balance</TD>
          <TD align="right">
            <Money value={data.totalDebit} />
          </TD>
          <TD align="right">
            <Money value={data.totalCredit} />
          </TD>
          <TD align="right" className="text-base">
            <Money value={data.closingBalance} />
          </TD>
        </TR>
      </TFoot>
    </Table>
  );
}

export function LedgerView({ party, id, siteId, projectId }: { party: 'client' | 'vendor'; id: string; siteId?: string; projectId?: string }) {
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo] = useState('');
  const range = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const client = useGetClientLedger(id, { ...range, siteId, projectId }, { query: { enabled: party === 'client' && !!id } });
  const vendor = useGetVendorLedger(id, range, { query: { enabled: party === 'vendor' && !!id } });
  const data = party === 'client' ? client.data : vendor.data;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={() =>
              saveBlob(
                () => (party === 'client' ? downloadClientStatement(id, { ...range, siteId, projectId }) : downloadVendorStatement(id, range)),
                `${data?.party.code ?? party}-statement.pdf`,
                'open',
              )
            }
          >
            <FileDown /> Statement PDF
          </Button>
        </div>
      </div>
      {!data ? <Loading /> : <LedgerTable data={data} partyLabel={party} />}
    </Card>
  );
}
