import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  LineChart,
  PackagePlus,
  PackageSearch,
  RotateCcw,
  Tags,
  Truck,
} from "lucide-react";

export type WmsNavChildItem = {
  href: string;
  label: string;
  requiredPermissions?: string[];
};

export type WmsNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  requiredPermissions?: string[];
  children?: WmsNavChildItem[];
};

export const WMS_NAV_ITEMS: WmsNavItem[] = [
  {
    href: "/partners",
    label: "Partners",
    description: "Partner accounts and onboarding",
    icon: Building2,
    requiredPermissions: ["wms.partners.read"],
  },
  {
    href: "/forecast",
    label: "Forecast",
    description: "Monday, Wednesday, Friday planning grid",
    icon: LineChart,
    requiredPermissions: ["wms.requests.read"],
  },
  {
    href: "/requests",
    label: "Requests",
    description: "Create, review, invoice, payment",
    icon: ClipboardCheck,
    requiredPermissions: ["wms.requests.read", "wms.billing.read"],
  },
  {
    href: "/products",
    label: "Products",
    description: "Partner-store variants and pricing",
    icon: Tags,
    requiredPermissions: ["wms.inventory.read"],
  },
  {
    href: "/inventory",
    label: "Inventory",
    description: "Stock, lots, COGS, and transfers",
    icon: PackageSearch,
    requiredPermissions: ["wms.inventory.read", "wms.warehouses.read"],
    children: [
      {
        href: "/inventory",
        label: "Overview",
        requiredPermissions: ["wms.inventory.read"],
      },
      {
        href: "/inventory/stock",
        label: "Stock",
        requiredPermissions: ["wms.inventory.read"],
      },
      {
        href: "/inventory/transfers",
        label: "Transfers",
        requiredPermissions: ["wms.inventory.read"],
      },
      {
        href: "/inventory/warehouses",
        label: "Warehouses",
        requiredPermissions: ["wms.warehouses.read"],
      },
    ],
  },
  {
    href: "/purchasing",
    label: "Purchasing",
    description: "Vendor and receiving workflows",
    icon: PackagePlus,
    requiredPermissions: ["wms.purchasing.read"],
    children: [
      {
        href: "/purchasing",
        label: "Overview",
        requiredPermissions: ["wms.purchasing.read"],
      },
      {
        href: "/purchasing/receipts",
        label: "Stock Receiving",
        requiredPermissions: ["wms.purchasing.read"],
      },
    ],
  },
  {
    href: "/fulfillment",
    label: "Fulfillment",
    description: "Pick, pack, and dispatch tasks",
    icon: Truck,
    requiredPermissions: ["wms.fulfillment.read"],
  },
  {
    href: "/rts",
    label: "RTS",
    description: "Returns, damages, and restock",
    icon: RotateCcw,
    requiredPermissions: ["wms.rts.read"],
  },
];
