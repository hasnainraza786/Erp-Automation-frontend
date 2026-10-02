import { P, type Permission } from '@erp/core';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: P.DASHBOARD_VIEW },
      { href: '/accounts', label: 'Accounts', icon: Wallet, permission: P.LEDGER_VIEW },
    ],
  },
  {
    title: 'Sales',
    items: [
      { href: '/clients', label: 'Clients', icon: Users, permission: P.CLIENT_VIEW },
      { href: '/sites', label: 'Sites', icon: Building2, permission: P.SITE_VIEW },
      { href: '/quotations', label: 'Quotations', icon: FileText, permission: P.QUOTATION_VIEW },
      { href: '/projects', label: 'Projects', icon: FolderKanban, permission: P.PROJECT_VIEW },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt, permission: P.INVOICE_VIEW },
      { href: '/payments', label: 'Payments', icon: HandCoins, permission: P.PAYMENT_VIEW },
      { href: '/ledgers', label: 'Ledgers', icon: ScrollText, permission: P.LEDGER_VIEW },
      { href: '/expenses', label: 'Expenses', icon: ClipboardList, permission: P.EXPENSE_VIEW },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { href: '/purchase-orders', label: 'Purchase orders', icon: ShoppingCart, permission: P.PURCHASE_VIEW },
      { href: '/vendors', label: 'Vendors', icon: Truck, permission: P.VENDOR_VIEW },
      { href: '/inventory', label: 'Inventory', icon: Boxes, permission: P.INVENTORY_VIEW },
      { href: '/products', label: 'Products', icon: Package, permission: P.PRODUCT_VIEW },
    ],
  },
  {
    title: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, permission: P.REPORT_VIEW },
      { href: '/data', label: 'Import / export', icon: FileSpreadsheet, permission: P.IMPORT_EXPORT },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** Deep link for a search result or notification. */
export function entityHref(type: string | null | undefined, id: string | null | undefined) {
  if (!type || !id) return null;
  const t = type.toUpperCase().replace(/[^A-Z]/g, '');
  const map: Record<string, string> = {
    CLIENT: '/clients/view',
    SITE: '/sites/view',
    PROJECT: '/projects/view',
    QUOTATION: '/quotations/view',
    PRODUCT: '/products/view',
    VENDOR: '/vendors/view',
    PAYMENT: '/payments/view',
    INVOICE: '/invoices/view',
    PURCHASEORDER: '/purchase-orders/view',
  };
  return map[t] ? `${map[t]}?id=${id}` : null;
}
