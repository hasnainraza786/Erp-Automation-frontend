'use client';

import { getListCategoriesQueryKey, useCreateCategory, useListCategories, useUpdateCategory } from '@erp/api-client';
import { Badge, Button, Dialog, DialogContent, Input, Select } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function CategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data } = useListCategories({ query: { enabled: open } });
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  const create = useCreateCategory({
    mutation: {
      onSuccess: () => {
        toast.success('Category added');
        setName('');
        refresh();
      },
    },
  });
  const update = useUpdateCategory({ mutation: { onSuccess: () => (setEditing(null), refresh()) } });

  const roots = data?.filter((c) => !c.parentId) ?? [];
  const childrenOf = (id: string) => data?.filter((c) => c.parentId === id) ?? [];

  const row = (c: NonNullable<typeof data>[number], child = false) => (
    <li key={c.id} className={`flex items-center gap-2 py-1.5 ${child ? 'pl-6' : ''}`}>
      {editing?.id === c.id ? (
        <>
          <Input className="h-8" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
          <Button size="icon-sm" onClick={() => update.mutate({ id: c.id, data: { name: editing.name } })} loading={update.isPending} aria-label="Save">
            <Check />
          </Button>
        </>
      ) : (
        <>
          <span className={`flex-1 text-sm ${c.isActive ? '' : 'text-muted-foreground line-through'} ${child ? '' : 'font-medium'}`}>{c.name}</span>
          <Badge>{c.productCount} products</Badge>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ id: c.id, name: c.name })} aria-label="Rename">
            <Pencil />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: c.id, data: { isActive: !c.isActive } })}>
            {c.isActive ? 'Disable' : 'Enable'}
          </Button>
        </>
      )}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Product categories" description="Two levels: category and subcategory." size="lg">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate({ data: { name: name.trim(), parentId: parentId || null } });
          }}
        >
          <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select className="w-52" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                Under {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={create.isPending}>
            <Plus /> Add
          </Button>
        </form>
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
          {roots.map((c) => (
            <div key={c.id}>
              {row(c)}
              {childrenOf(c.id).map((s) => row(s, true))}
            </div>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
