'use client';

import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@erp/ui';
import { useState } from 'react';
import { LedgerView } from '@/components/ledger-view';
import { PageHeader } from '@/components/page';
import { ClientPicker, VendorPicker } from '@/components/pickers';

export default function LedgersPage() {
  const [tab, setTab] = useState('clients');
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const [vendor, setVendor] = useState<{ id: string; label: string } | null>(null);

  return (
    <>
      <PageHeader title="Ledgers" description="Derived from the journal. Balances cannot be edited by hand." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="clients">Client ledger</TabsTrigger>
          <TabsTrigger value="vendors">Vendor ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <Card className="mb-4 p-3">
            <div className="max-w-md">
              <ClientPicker value={client?.id} label={client?.label} onChange={setClient} />
            </div>
          </Card>
          {client ? <LedgerView party="client" id={client.id} /> : <p className="text-sm text-muted-foreground">Select a client to open the ledger.</p>}
        </TabsContent>
        <TabsContent value="vendors">
          <Card className="mb-4 p-3">
            <div className="max-w-md">
              <VendorPicker value={vendor?.id} label={vendor?.label} onChange={setVendor} />
            </div>
          </Card>
          {vendor ? <LedgerView party="vendor" id={vendor.id} /> : <p className="text-sm text-muted-foreground">Select a vendor to open the ledger.</p>}
        </TabsContent>
      </Tabs>
    </>
  );
}
