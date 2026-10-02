/** Mirrors the backend permission keys. `*` grants everything. */
export const P = {
  DASHBOARD_VIEW: 'dashboard:view',
  CLIENT_VIEW: 'client:view',
  CLIENT_MANAGE: 'client:manage',
  SITE_VIEW: 'site:view',
  SITE_MANAGE: 'site:manage',
  PRODUCT_VIEW: 'product:view',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_COST_VIEW: 'product:cost_view',
  PRODUCT_PRICE_OVERRIDE: 'product:price_override',
  VENDOR_VIEW: 'vendor:view',
  VENDOR_MANAGE: 'vendor:manage',
  QUOTATION_VIEW: 'quotation:view',
  QUOTATION_MANAGE: 'quotation:manage',
  QUOTATION_APPROVE: 'quotation:approve',
  PROJECT_VIEW: 'project:view',
  PROJECT_MANAGE: 'project:manage',
  PROJECT_PROGRESS: 'project:progress',
  INVOICE_VIEW: 'invoice:view',
  INVOICE_MANAGE: 'invoice:manage',
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_VOID: 'payment:void',
  LEDGER_VIEW: 'ledger:view',
  EXPENSE_VIEW: 'expense:view',
  EXPENSE_MANAGE: 'expense:manage',
  PURCHASE_VIEW: 'purchase:view',
  PURCHASE_MANAGE: 'purchase:manage',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_MANAGE: 'inventory:manage',
  REPORT_VIEW: 'report:view',
  SETTINGS_MANAGE: 'settings:manage',
  USER_MANAGE: 'user:manage',
  AUDIT_VIEW: 'audit:view',
  BACKUP_MANAGE: 'backup:manage',
  IMPORT_EXPORT: 'data:import_export',
} as const;

export type Permission = (typeof P)[keyof typeof P];

export function can(granted: readonly string[] | undefined, required: Permission | Permission[] | undefined) {
  if (!required) return true;
  if (!granted) return false;
  if (granted.includes('*')) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((p) => granted.includes(p));
}
