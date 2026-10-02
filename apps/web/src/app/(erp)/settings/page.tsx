'use client';

import {
  downloadBackup,
  useCreateBackup,
  useCreateRole,
  useCreateSpacePreset,
  useCreateUser,
  useDeleteRole,
  useGetPermissionCatalog,
  useGetSettings,
  useListAuditLogs,
  useListBackups,
  useListRoles,
  useListSpacePresets,
  useListUsers,
  useResetUserPassword,
  useUpdateAccountingSettings,
  useUpdateCompanySettings,
  useUpdateInvoiceSettings,
  useUpdateNumberingSettings,
  useUpdateQuotationSettings,
  useUpdateRole,
  useUpdateSpacePreset,
  useUpdateUser,
  useUploadCompanyLogo,
  type SettingsDtoOutput,
  type UpdateAccountingSettingsDtoReceivableOn,
} from '@erp/api-client';
import { fmtDateTime, humanize, P } from '@erp/core';
import { Button, Card, CardContent, CardHeader, Checkbox, Field, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@erp/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Can, useAuth } from '@/components/auth';
import { ConfirmDialog } from '@/components/confirm';
import { DataTable, ListCard, Loading, PageHeader, Pagination } from '@/components/page';
import { TERM_FIELDS } from '@/lib/quotation';
import { saveBlob } from '@/lib/files';
import { useQueryState } from '@/lib/hooks';

export default function SettingsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('company');
  const { data: settings, isLoading } = useGetSettings();
  if (isLoading || !settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <Loading />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Settings" description="Company profile, numbering, users and audit" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="quotation">Quotations</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
          <TabsTrigger value="numbering">Numbering</TabsTrigger>
          <TabsTrigger value="spaces">Spaces</TabsTrigger>
          {can(P.USER_MANAGE) && <TabsTrigger value="users">Users</TabsTrigger>}
          {can(P.USER_MANAGE) && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {can(P.AUDIT_VIEW) && <TabsTrigger value="audit">Audit</TabsTrigger>}
          {can(P.BACKUP_MANAGE) && <TabsTrigger value="backups">Backups</TabsTrigger>}
        </TabsList>
        <TabsContent value="company">
          <CompanyForm settings={settings} />
        </TabsContent>
        <TabsContent value="quotation">
          <QuotationForm settings={settings} />
        </TabsContent>
        <TabsContent value="accounting">
          <AccountingForm settings={settings} />
        </TabsContent>
        <TabsContent value="numbering">
          <NumberingForm settings={settings} />
        </TabsContent>
        <TabsContent value="spaces">
          <SpacesForm />
        </TabsContent>
        <TabsContent value="users">
          <UsersForm />
        </TabsContent>
        <TabsContent value="roles">
          <RolesForm />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
        <TabsContent value="backups">
          <BackupsPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CompanyForm({ settings }: { settings: SettingsDtoOutput }) {
  const qc = useQueryClient();
  const [c, setC] = useState(settings.company);
  const save = useUpdateCompanySettings({ mutation: { onSuccess: () => (toast.success('Company saved'), qc.invalidateQueries()) } });
  const logo = useUploadCompanyLogo({ mutation: { onSuccess: () => toast.success('Logo uploaded') } });
  return (
    <Card>
      <CardHeader title="Company profile" description="Appears on quotations, invoices and statements" />
      <CardContent className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2">
          <Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={c.email ?? ''} onChange={(e) => setC({ ...c, email: e.target.value })} />
        </Field>
        <Field label="Website" className="sm:col-span-2">
          <Input value={c.website ?? ''} onChange={(e) => setC({ ...c, website: e.target.value })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={c.address ?? ''} onChange={(e) => setC({ ...c, address: e.target.value })} />
        </Field>
        <Field label="Tax information" className="sm:col-span-2">
          <Input value={c.taxInfo ?? ''} onChange={(e) => setC({ ...c, taxInfo: e.target.value })} />
        </Field>
        <Field label="Logo">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && logo.mutate({ data: { file: e.target.files[0] } })} />
        </Field>
        <div className="sm:col-span-2">
          <Can permission={P.SETTINGS_MANAGE}>
            <Button onClick={() => save.mutate({ data: c })} loading={save.isPending}>
              Save
            </Button>
          </Can>
        </div>
      </CardContent>
    </Card>
  );
}

function QuotationForm({ settings }: { settings: SettingsDtoOutput }) {
  const qc = useQueryClient();
  const q = settings.quotation;
  const [validityDays, setDays] = useState(q.validityDays);
  const [terms, setTerms] = useState<Record<string, string>>(q.defaultTerms ?? {});
  const [schedule, setSchedule] = useState(q.defaultPaymentSchedule.map((s) => ({ name: s.name, percent: String(s.percent) })));
  const save = useUpdateQuotationSettings({ mutation: { onSuccess: () => (toast.success('Quotation defaults saved'), qc.invalidateQueries()) } });
  return (
    <Card>
      <CardHeader title="Quotation defaults" />
      <CardContent className="space-y-4">
        <Field label="Validity (days)" className="max-w-xs">
          <Input type="number" value={validityDays} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          {TERM_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Textarea rows={2} value={terms[key] ?? ''} onChange={(e) => setTerms({ ...terms, [key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Default payment schedule</p>
          {schedule.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input value={s.name} onChange={(e) => setSchedule(schedule.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} />
              <Input className="w-24" value={s.percent} onChange={(e) => setSchedule(schedule.map((x, idx) => (idx === i ? { ...x, percent: e.target.value } : x)))} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSchedule([...schedule, { name: '', percent: '' }])}>
            Add milestone
          </Button>
        </div>
        <Can permission={P.SETTINGS_MANAGE}>
          <Button
            onClick={() =>
              save.mutate({
                data: {
                  validityDays,
                  defaultTerms: terms,
                  defaultPaymentSchedule: schedule.filter((s) => s.name).map((s) => ({ name: s.name, percent: Number(s.percent) })),
                },
              })
            }
            loading={save.isPending}
          >
            Save
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}

function AccountingForm({ settings }: { settings: SettingsDtoOutput }) {
  const qc = useQueryClient();
  const [receivableOn, setOn] = useState(settings.accounting.receivableOn);
  const [tax, setTax] = useState(String(settings.accounting.defaultTaxRate));
  const [dueDays, setDue] = useState(settings.invoice.dueDays);
  const [footer, setFooter] = useState(settings.invoice.footerNote ?? '');
  const acc = useUpdateAccountingSettings({ mutation: { onSuccess: () => toast.success('Accounting saved') } });
  const inv = useUpdateInvoiceSettings({ mutation: { onSuccess: () => toast.success('Invoice settings saved') } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Accounting model" />
        <CardContent className="space-y-3">
          <Field label="Create receivable when" hint="Approval posts AR immediately. Invoice waits until you bill a milestone.">
            <Select value={receivableOn} onChange={(e) => setOn(e.target.value as UpdateAccountingSettingsDtoReceivableOn)}>
              <option value="APPROVAL">Quotation approved</option>
              <option value="INVOICE">Invoice issued</option>
            </Select>
          </Field>
          <Field label="Default tax rate %">
            <Input value={tax} onChange={(e) => setTax(e.target.value)} />
          </Field>
          <Can permission={P.SETTINGS_MANAGE}>
            <Button onClick={() => acc.mutate({ data: { receivableOn, defaultTaxRate: Number(tax) } })} loading={acc.isPending}>
              Save
            </Button>
          </Can>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Invoices" />
        <CardContent className="space-y-3">
          <Field label="Default due days">
            <Input type="number" value={dueDays} onChange={(e) => setDue(Number(e.target.value))} />
          </Field>
          <Field label="Footer note">
            <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} />
          </Field>
          <Can permission={P.SETTINGS_MANAGE}>
            <Button onClick={() => inv.mutate({ data: { dueDays, footerNote: footer } })} loading={inv.isPending}>
              Save
            </Button>
          </Can>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberingForm({ settings }: { settings: SettingsDtoOutput }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(Object.entries(settings.numbering).map(([key, v]) => ({ key, ...v })));
  const save = useUpdateNumberingSettings({ mutation: { onSuccess: () => (toast.success('Numbering saved'), qc.invalidateQueries()) } });
  return (
    <Card>
      <CardHeader title="Document numbering" description="Changes apply to the next number issued. Existing documents are not renamed." />
      <CardContent>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-4 items-end gap-2">
              <Field label="Document">
                <Input value={r.key} disabled />
              </Field>
              <Field label="Prefix">
                <Input value={r.prefix} onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, prefix: e.target.value } : x)))} />
              </Field>
              <Field label="Padding">
                <Input type="number" value={r.padding} onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, padding: Number(e.target.value) } : x)))} />
              </Field>
              <Checkbox checked={r.yearly} onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, yearly: e.target.checked } : x)))} label="Reset yearly" />
            </div>
          ))}
        </div>
        <Can permission={P.SETTINGS_MANAGE}>
          <Button
            className="mt-4"
            onClick={() => save.mutate({ data: Object.fromEntries(rows.map((r) => [r.key, { prefix: r.prefix, yearly: r.yearly, padding: r.padding }])) })}
            loading={save.isPending}
          >
            Save
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}

function SpacesForm() {
  const qc = useQueryClient();
  const { data } = useListSpacePresets();
  const [name, setName] = useState('');
  const create = useCreateSpacePreset({ mutation: { onSuccess: () => (toast.success('Space added'), setName(''), qc.invalidateQueries()) } });
  const update = useUpdateSpacePreset({ mutation: { onSuccess: () => qc.invalidateQueries() } });
  return (
    <Card>
      <CardHeader title="Space presets" description="Living Room, Kitchen, and other rooms offered in the quotation builder" />
      <CardContent>
        <div className="mb-4 flex gap-2">
          <Input className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" />
          <Can permission={P.SETTINGS_MANAGE}>
            <Button disabled={name.trim().length < 1} onClick={() => create.mutate({ data: { name: name.trim(), sortOrder: (data?.length ?? 0) + 1 } })}>
              Add
            </Button>
          </Can>
        </div>
        <DataTable
          rows={data}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => r.name },
            { key: 'sort', header: 'Order', cell: (r) => r.sortOrder },
            {
              key: 'active',
              header: 'Active',
              cell: (r) => (
                <Checkbox checked={r.isActive} onChange={(e) => update.mutate({ id: r.id, data: { isActive: e.target.checked } })} label={r.isActive ? 'Yes' : 'No'} />
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function UsersForm() {
  const qc = useQueryClient();
  const { data: users } = useListUsers();
  const { data: roles } = useListRoles();
  const [open, setOpen] = useState(false);
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '', phone: '' });
  const create = useCreateUser({
    mutation: {
      onSuccess: () => {
        toast.success('User created');
        setOpen(false);
        qc.invalidateQueries();
      },
    },
  });
  const update = useUpdateUser({ mutation: { onSuccess: () => qc.invalidateQueries() } });
  const resetPw = useResetUserPassword({ mutation: { onSuccess: () => (toast.success('Password reset'), setReset(null)) } });
  const [newPw, setNewPw] = useState('');

  return (
    <>
      <ListCard
        toolbar={
          <Button size="sm" onClick={() => setOpen(true)}>
            New user
          </Button>
        }
      >
        <DataTable
          rows={users}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'email', header: 'Email', cell: (r) => r.email },
            { key: 'role', header: 'Role', cell: (r) => r.role.name },
            { key: 'last', header: 'Last login', cell: (r) => fmtDateTime(r.lastLoginAt) },
            {
              key: 'active',
              header: 'Active',
              cell: (r) => (
                <Checkbox checked={r.isActive} onChange={(e) => update.mutate({ id: r.id, data: { isActive: e.target.checked } })} label={r.isActive ? 'Yes' : 'No'} />
              ),
            },
            {
              key: 'act',
              header: '',
              align: 'right',
              cell: (r) => (
                <Button variant="outline" size="sm" onClick={() => (setNewPw(''), setReset({ id: r.id, name: r.name }))}>
                  Reset password
                </Button>
              ),
            },
          ]}
        />
      </ListCard>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="New user"
        confirmLabel="Create"
        loading={create.isPending}
        onConfirm={() => create.mutate({ data: { ...form, roleId: form.roleId, phone: form.phone || null } })}
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role" required>
            <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">Select…</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!reset}
        onOpenChange={(o) => !o && setReset(null)}
        title={`Reset password for ${reset?.name}?`}
        confirmLabel="Reset"
        loading={resetPw.isPending}
        onConfirm={() => reset && resetPw.mutate({ id: reset.id, data: { password: newPw } })}
      >
        <Field label="New password" required>
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function RolesForm() {
  const qc = useQueryClient();
  const { data: roles } = useListRoles();
  const { data: catalog } = useGetPermissionCatalog();
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; permissions: string[] } | null>(null);
  const create = useCreateRole({ mutation: { onSuccess: () => (toast.success('Role created'), setEdit(null), qc.invalidateQueries()) } });
  const update = useUpdateRole({ mutation: { onSuccess: () => (toast.success('Role saved'), setEdit(null), qc.invalidateQueries()) } });
  const del = useDeleteRole({ mutation: { onSuccess: () => (toast.success('Role deleted'), qc.invalidateQueries()) } });

  const toggle = (key: string) => edit && setEdit({ ...edit, permissions: edit.permissions.includes(key) ? edit.permissions.filter((p) => p !== key) : [...edit.permissions, key] });

  return (
    <>
      <ListCard
        toolbar={
          <Button size="sm" onClick={() => setEdit({ name: '', description: '', permissions: [] })}>
            New role
          </Button>
        }
      >
        <DataTable
          rows={roles}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Role', cell: (r) => r.name },
            { key: 'desc', header: 'Description', cell: (r) => r.description ?? '—' },
            { key: 'users', header: 'Users', align: 'right', cell: (r) => r.userCount },
            { key: 'sys', header: '', cell: (r) => (r.isSystem ? 'System' : '') },
            {
              key: 'act',
              header: '',
              align: 'right',
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEdit({ id: r.id, name: r.name, description: r.description ?? '', permissions: r.permissions })}>
                    Edit
                  </Button>
                  {!r.isSystem && (
                    <Button variant="ghost" size="sm" onClick={() => del.mutate({ id: r.id })}>
                      Delete
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </ListCard>
      <ConfirmDialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? 'Edit role' : 'New role'}
        confirmLabel="Save"
        loading={create.isPending || update.isPending}
        onConfirm={() => {
          if (!edit) return;
          const data = { name: edit.name, description: edit.description || null, permissions: edit.permissions };
          if (edit.id) update.mutate({ id: edit.id, data });
          else create.mutate({ data });
        }}
      >
        {edit && (
          <div className="space-y-3">
            <Field label="Name">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {catalog?.map((g) => (
                <div key={g.group}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{g.group}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.permissions.map((p) => (
                      <Checkbox key={p.key} checked={edit.permissions.includes(p.key) || edit.permissions.includes('*')} onChange={() => toggle(p.key)} label={p.label} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

function AuditLog() {
  const [f, setF] = useQueryState({ q: '', page: 1 });
  const { data, isLoading } = useListAuditLogs({ q: f.q || undefined, page: f.page, pageSize: 40 });
  return (
    <ListCard toolbar={<Input placeholder="Search actions…" value={f.q} onChange={(e) => setF({ q: e.target.value })} className="w-72" />}>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'at', header: 'When', cell: (r) => fmtDateTime(r.createdAt) },
          { key: 'actor', header: 'Who', cell: (r) => r.actorName ?? 'System' },
          { key: 'action', header: 'Action', cell: (r) => r.action },
          { key: 'entity', header: 'Entity', cell: (r) => `${r.entityType}${r.entityId ? ' · ' + r.entityId.slice(0, 8) : ''}` },
          { key: 'sum', header: 'Summary', cell: (r) => r.summary ?? '—' },
        ]}
      />
      <Pagination meta={data?.meta} onPage={(page) => setF({ page })} />
    </ListCard>
  );
}

function BackupsPanel() {
  const qc = useQueryClient();
  const { data } = useListBackups();
  const create = useCreateBackup({ mutation: { onSuccess: () => (toast.success('Backup created'), qc.invalidateQueries()) } });
  return (
    <ListCard
      toolbar={
        <Button size="sm" onClick={() => create.mutate()} loading={create.isPending}>
          Create backup now
        </Button>
      }
    >
      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        columns={[
          { key: 'file', header: 'File', cell: (r) => r.fileName },
          { key: 'at', header: 'Created', cell: (r) => fmtDateTime(r.createdAt) },
          { key: 'by', header: 'By', cell: (r) => r.createdBy ?? '—' },
          { key: 'size', header: 'Size', align: 'right', cell: (r) => `${Math.round(r.size / 1024)} KB` },
          { key: 'rows', header: 'Rows', align: 'right', cell: (r) => r.rows },
          {
            key: 'dl',
            header: '',
            align: 'right',
            cell: (r) => (
              <Button variant="outline" size="sm" onClick={() => saveBlob(() => downloadBackup(r.id), r.fileName)}>
                Download
              </Button>
            ),
          },
        ]}
      />
    </ListCard>
  );
}
