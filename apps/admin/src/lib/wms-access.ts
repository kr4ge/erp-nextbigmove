import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BadgeDollarSign,
  Building2,
  Boxes,
  FileSpreadsheet,
  LayoutGrid,
  PackageCheck,
  Route,
  Truck,
  Warehouse,
} from 'lucide-react';

export const WMS_PERMISSION_PREFIX = 'wms.';

export function hasWmsAccess(role: string | null | undefined, permissions: string[]): boolean {
  if (role === 'SUPER_ADMIN') {
    return true;
  }

  return permissions.some((permission) => permission.startsWith(WMS_PERMISSION_PREFIX));
}

export type WmsNavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  platformOnly?: boolean;
  children?: WmsNavItemChild[];
};

export type WmsNavItemChild = {
  href: string;
  label: string;
  permission?: string;
  platformOnly?: boolean;
};

export const WMS_NAV_ITEMS: WmsNavItem[] = [
  {
    href: '/wms',
    label: 'Dashboard',
    icon: LayoutGrid,
    permission: 'wms.core.read',
  },
  {
    href: '/tenants',
    label: 'Partners',
    icon: Building2,
    platformOnly: true,
  },
  {
    href: '/purchasing',
    label: 'Purchasing',
    icon: BadgeDollarSign,
    permission: 'wms.purchasing.read',
  },
  {
    href: '/warehouses',
    label: 'Warehouses',
    icon: Warehouse,
    permission: 'wms.warehouses.read',
  },
  {
    href: '/products',
    label: 'Products',
    icon: Boxes,
    permission: 'wms.products.read',
  },
  {
    label: 'Inventory',
    icon: Archive,
    children: [
      {
        href: '/inventory/stock',
        label: 'Stock',
        permission: 'wms.inventory.read',
      },
      {
        href: '/inventory/stock-receiving',
        label: 'Stock Receiving',
        permission: 'wms.receiving.read',
      },
      {
        href: '/inventory/transfer',
        label: 'Transfer',
        permission: 'wms.receiving.read',
      },
    ],
  },
  {
    href: '/orders',
    label: 'Fulfillment',
    icon: PackageCheck,
    permission: 'wms.fulfillment.read',
  },
  {
    href: '/shipments',
    label: 'Dispatch',
    icon: Truck,
    permission: 'wms.dispatch.read',
  },
  {
    href: '/tracking',
    label: 'RTS',
    icon: Route,
    permission: 'wms.rts.read',
  },
  {
    href: '/reports',
    label: 'Forecast',
    icon: FileSpreadsheet,
    permission: 'wms.forecast.read',
  },
];
