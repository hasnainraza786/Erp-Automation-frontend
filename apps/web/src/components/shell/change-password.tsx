'use client';

import { useChangePassword } from '@erp/api-client';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input } from '@erp/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth';

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useChangePassword({
    mutation: {
      onSuccess: () => {
        toast.success('Password changed. Please sign in again.');
        onOpenChange(false);
        logout();
      },
    },
  });
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change password" size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate({ data: { currentPassword: current, newPassword: next } });
          }}
        >
          <Field label="Current password" required>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="New password" hint="At least 8 characters" required>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" required />
          </Field>
          <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined} required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={change.isPending} disabled={mismatch || next.length < 8}>
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
