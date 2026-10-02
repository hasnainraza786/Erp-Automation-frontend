'use client';

import { useAdjustStock } from '@erp/api-client';
import { qty } from '@erp/core';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/** Stock adjustment by signed delta (e.g. -2 for breakage, +5 for opening stock). */
export function StockAdjustDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product: { id: string; name: string; onHand: string } | null }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setDelta('');
      setReason('');
    }
  }, [open]);
  const adjust = useAdjustStock({
    mutation: {
      onSuccess: () => {
        toast.success('Stock adjusted');
        qc.invalidateQueries({ queryKey: ['/api/v1/inventory'] });
        qc.invalidateQueries({ queryKey: [`/api/v1/inventory/${product?.id}/transactions`] });
        qc.invalidateQueries({ queryKey: [`/api/v1/products/${product?.id}`] });
        qc.invalidateQueries({ queryKey: ['/api/v1/products'] });
        onOpenChange(false);
      },
    },
  });
  const n = Number(delta);
  const valid = delta !== '' && Number.isFinite(n) && n !== 0 && reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Adjust stock" description={product?.name} size="sm">
        <Field label="Quantity change" hint={product ? `On hand ${qty(product.onHand)} → ${valid ? qty(Number(product.onHand) + n) : '…'}` : undefined} required>
          <Input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="decimal" placeholder="+5 or -2" autoFocus />
        </Field>
        <Field label="Reason" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opening stock, breakage, count correction…" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || !product} loading={adjust.isPending} onClick={() => product && adjust.mutate({ data: { productId: product.id, qty: delta, reason: reason.trim() } })}>
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
