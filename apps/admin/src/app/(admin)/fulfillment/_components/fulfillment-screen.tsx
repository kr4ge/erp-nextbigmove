"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck,
  PackagePlus,
  RotateCcw,
  ScanLine,
  Search,
  Truck,
} from "lucide-react";
import { InventoryEmptyState } from "../../inventory/_components/inventory-empty-state";
import { fetchInventoryPosProductFilters } from "../../inventory/_services/inventory.service";
import type { Partner } from "../../partners/_types/partners";
import { fetchPartners } from "../../partners/_services/partners.service";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { fetchWarehouses } from "../../warehouses/_services/warehouses.service";
import { PackingStationModal } from "./packing-station-modal";
import { FulfillmentStatusBadge } from "./fulfillment-status-badge";
import { FulfillmentWorkspaceModal } from "./fulfillment-workspace-modal";
import {
  assignWmsFulfillmentPacking,
  createWmsPackingStation,
  fetchWmsFulfillmentOperators,
  fetchWmsFulfillmentOrder,
  fetchWmsFulfillmentOrders,
  fetchWmsPackingStations,
  scanWmsFulfillmentPackUnit,
  scanWmsFulfillmentPickUnit,
  setWmsFulfillmentOrderStatus,
  startWmsFulfillmentPacking,
  startWmsFulfillmentPicking,
  syncWmsFulfillmentIntake,
  updateWmsPackingStation,
} from "../_services/fulfillment.service";
import type {
  CreateWmsPackingStationInput,
  WmsFulfillmentOrder,
  WmsFulfillmentOrderStatus,
  WmsFulfillmentView,
  WmsPackingStation,
} from "../_types/fulfillment";
import {
  formatOperatorLabel,
  formatOrderDate,
  formatShortDateTime,
} from "../_utils/fulfillment-format";

type FulfillmentTabKey = "PICKING" | "PACKING" | "DISPATCH" | "STATIONS";

const FULFILLMENT_TABS: Array<{ key: FulfillmentTabKey; label: string }> = [
  { key: "PICKING", label: "Picker Queue" },
  { key: "PACKING", label: "Packing Queue" },
  { key: "DISPATCH", label: "Dispatch" },
  { key: "STATIONS", label: "Stations" },
];

const PICKING_STATUS_OPTIONS: Array<{
  value: WmsFulfillmentOrderStatus | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "WAITING_FOR_STOCK", label: "Waiting Stock" },
  { value: "PICKING", label: "Picking" },
  { value: "PICKED", label: "Picked" },
  { value: "HOLD", label: "Hold" },
];

const PACKING_STATUS_OPTIONS: Array<{
  value: WmsFulfillmentOrderStatus | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PACKING_PENDING", label: "Pending" },
  { value: "PACKING_ASSIGNED", label: "Assigned" },
  { value: "PACKING", label: "Packing" },
  { value: "PACKED", label: "Packed" },
];

const DISPATCH_STATUS_OPTIONS: Array<{
  value: WmsFulfillmentOrderStatus | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PACKED", label: "Ready Dispatch" },
  { value: "DISPATCHED", label: "Dispatched" },
];

function QueueTabs({
  activeTab,
  onChange,
}: {
  activeTab: FulfillmentTabKey;
  onChange: (tab: FulfillmentTabKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FULFILLMENT_TABS.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              active
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function OrderCell({ order }: { order: WmsFulfillmentOrder }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate font-semibold text-slate-950">
          {order.fulfillmentCode}
        </p>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          {order.trackingNumber}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-slate-500">
        {order.tenant?.name || "No partner"} · {order.store?.name || "No store"}
      </p>
      <p className="mt-1 truncate text-sm text-slate-400">
        {order.customerName || "Unnamed customer"} ·{" "}
        {formatOrderDate(order.orderDateLocal)}
      </p>
    </div>
  );
}

function QueueTable({
  mode,
  rows,
  onOpen,
}: {
  mode: WmsFulfillmentView;
  rows: WmsFulfillmentOrder[];
  onOpen: (orderId: string, mode: WmsFulfillmentView) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed text-sm">
        {mode === "PICKING" ? (
          <>
            <colgroup>
              <col className="w-[41%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="border-y border-slate-200 bg-slate-50/80">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5 text-right">Need</th>
                <th className="px-4 py-3.5 text-right">Picked</th>
                <th className="px-4 py-3.5 text-right">Short</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/60 last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <OrderCell order={order} />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                    {order.progress.required}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                    {order.progress.picked}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">
                    <span
                      className={
                        order.shortageQuantity > 0
                          ? "text-rose-600"
                          : "text-slate-500"
                      }
                    >
                      {order.shortageQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <FulfillmentStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onOpen(order.id, "PICKING")}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        ) : (
          <>
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="border-y border-slate-200 bg-slate-50/80">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5 text-right">
                  {mode === "DISPATCH" ? "Packed" : "Picked"}
                </th>
                <th className="px-4 py-3.5 text-right">
                  {mode === "DISPATCH" ? "Units" : "Packed"}
                </th>
                <th className="px-4 py-3.5">
                  {mode === "DISPATCH" ? "Dispatched" : "Station"}
                </th>
                <th className="px-4 py-3.5">
                  {mode === "DISPATCH" ? "Handler" : "Packer"}
                </th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/60 last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <OrderCell order={order} />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                    {mode === "DISPATCH"
                      ? order.progress.packed
                      : order.progress.picked}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                    {mode === "DISPATCH"
                      ? order.totalQuantity
                      : order.progress.packed}
                  </td>
                  <td className="px-4 py-4">
                    {mode === "DISPATCH" ? (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">
                          {formatShortDateTime(order.dispatchedAt)}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {order.posStatusName || order.posStatus || "Awaiting POS pickup"}
                        </p>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">
                          {order.packingStation?.name || "Not assigned"}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {order.packingStation?.warehouse.name ||
                            order.warehouse?.name ||
                            "No warehouse"}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="truncate whitespace-nowrap text-sm font-medium text-slate-700">
                      {mode === "DISPATCH"
                        ? formatOperatorLabel(order.packerUser || order.pickerUser)
                        : formatOperatorLabel(order.packerUser)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <FulfillmentStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        onOpen(order.id, mode === "DISPATCH" ? "DISPATCH" : "PACKING")
                      }
                      className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                    >
                      {mode === "DISPATCH" ? "View" : "Open"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </table>
    </div>
  );
}

function StationsTable({
  rows,
  onEdit,
}: {
  rows: WmsPackingStation[];
  onEdit: (station: WmsPackingStation) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[22%]" />
          <col className="w-[24%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[6%]" />
        </colgroup>
        <thead className="border-y border-slate-200 bg-slate-50/80">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <th className="px-4 py-3.5">Station</th>
            <th className="px-4 py-3.5">Warehouse</th>
            <th className="px-4 py-3.5">Operators</th>
            <th className="px-4 py-3.5 text-right">Active</th>
            <th className="px-4 py-3.5 text-center">Status</th>
            <th className="px-4 py-3.5 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((station) => (
            <tr
              key={station.id}
              className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/60 last:border-b-0"
            >
              <td className="px-4 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-950">
                      {station.name}
                    </p>
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                      {station.code}
                    </span>
                  </div>
                  {station.notes ? (
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {station.notes}
                    </p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">
                    {station.warehouse.name}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {station.warehouse.code}
                  </p>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {station.assignedUsers.length === 0 ? (
                    <span className="text-sm text-slate-400">No users</span>
                  ) : (
                    station.assignedUsers.slice(0, 3).map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {user.name || user.email}
                      </span>
                    ))
                  )}
                  {station.assignedUsers.length > 3 ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      +{station.assignedUsers.length - 3}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                {station.activeOrders}
              </td>
              <td className="px-4 py-4 text-center">
                <FulfillmentStatusBadge kind="station" status={station.status} />
              </td>
              <td className="px-4 py-4 text-center">
                <button
                  type="button"
                  onClick={() => onEdit(station)}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FulfillmentScreen() {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FulfillmentTabKey>("PICKING");
  const [tenantId, setTenantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [warehouseId, setWarehouseId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [screenMessage, setScreenMessage] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderMode, setSelectedOrderMode] =
    useState<WmsFulfillmentView>("PICKING");
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<WmsPackingStation | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedPermissions = localStorage.getItem("admin_permissions");
    const storedUser = localStorage.getItem("user");
    setPermissions(
      storedPermissions ? (JSON.parse(storedPermissions) as string[]) : [],
    );
    setUserRole(
      storedUser
        ? (JSON.parse(storedUser) as { role?: string | null }).role || null
        : null,
    );
  }, []);

  const canWrite =
    userRole === "SUPER_ADMIN" ||
    permissions.includes("wms.fulfillment.create") ||
    permissions.includes("wms.fulfillment.update");

  const partnersQuery = useQuery({
    queryKey: ["wms-partners"],
    queryFn: fetchPartners,
  });

  const filtersQuery = useQuery({
    queryKey: ["wms-fulfillment-shop-filters", tenantId],
    queryFn: () => fetchInventoryPosProductFilters(tenantId || undefined),
  });

  const warehousesQuery = useQuery({
    queryKey: ["wms-warehouses"],
    queryFn: fetchWarehouses,
  });

  const operatorsQuery = useQuery({
    queryKey: ["wms-fulfillment-operators"],
    queryFn: fetchWmsFulfillmentOperators,
  });

  const stationsQuery = useQuery({
    queryKey: ["wms-fulfillment-stations"],
    queryFn: () => fetchWmsPackingStations(),
  });

  const serverWarehouseId = warehouseId === "ALL" ? undefined : warehouseId;

  const pickingOrdersQuery = useQuery({
    queryKey: [
      "wms-fulfillment-orders",
      "picking",
      tenantId,
      storeId,
      serverWarehouseId,
    ],
    queryFn: () =>
      fetchWmsFulfillmentOrders({
        view: "PICKING",
        tenantId: tenantId || undefined,
        storeId: storeId || undefined,
        warehouseId: serverWarehouseId,
        limit: 200,
      }),
  });

  const packingOrdersQuery = useQuery({
    queryKey: [
      "wms-fulfillment-orders",
      "packing",
      tenantId,
      storeId,
      serverWarehouseId,
    ],
    queryFn: () =>
      fetchWmsFulfillmentOrders({
        view: "PACKING",
        tenantId: tenantId || undefined,
        storeId: storeId || undefined,
        warehouseId: serverWarehouseId,
        limit: 200,
      }),
  });

  const dispatchOrdersQuery = useQuery({
    queryKey: [
      "wms-fulfillment-orders",
      "dispatch",
      tenantId,
      storeId,
      serverWarehouseId,
    ],
    queryFn: () =>
      fetchWmsFulfillmentOrders({
        view: "DISPATCH",
        tenantId: tenantId || undefined,
        storeId: storeId || undefined,
        warehouseId: serverWarehouseId,
        limit: 200,
      }),
  });

  const selectedOrderQuery = useQuery({
    queryKey: ["wms-fulfillment-order", selectedOrderId],
    queryFn: () => fetchWmsFulfillmentOrder(selectedOrderId as string),
    enabled: Boolean(selectedOrderId),
  });

  const partners = partnersQuery.data || [];
  const shops = (filtersQuery.data?.shops || []).filter((shop) =>
    tenantId ? shop.tenantId === tenantId : true,
  );
  const warehouses = warehousesQuery.data || [];
  const stations = useMemo(() => stationsQuery.data ?? [], [stationsQuery.data]);
  const operators = operatorsQuery.data || [];
  const pickingOrders = useMemo(
    () => pickingOrdersQuery.data ?? [],
    [pickingOrdersQuery.data],
  );
  const packingOrders = useMemo(
    () => packingOrdersQuery.data ?? [],
    [packingOrdersQuery.data],
  );
  const dispatchOrders = useMemo(
    () => dispatchOrdersQuery.data ?? [],
    [dispatchOrdersQuery.data],
  );

  const activeTabStatusOptions =
    activeTab === "PICKING"
      ? PICKING_STATUS_OPTIONS
      : activeTab === "PACKING"
        ? PACKING_STATUS_OPTIONS
        : activeTab === "DISPATCH"
          ? DISPATCH_STATUS_OPTIONS
        : [
            { value: "ALL", label: "All Statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ];

  const statTotals = useMemo(
    () => ({
      pickingQueue: pickingOrders.length,
      waitingStock: pickingOrders.filter(
        (order) => order.status === "WAITING_FOR_STOCK",
      ).length,
      packingQueue: packingOrders.length,
      dispatchQueue: dispatchOrders.length,
    }),
    [dispatchOrders, packingOrders, pickingOrders],
  );

  const filteredPickingRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return pickingOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;
      const haystack = [
        order.fulfillmentCode,
        order.trackingNumber,
        order.customerName || "",
        order.tenant?.name || "",
        order.store?.name || "",
        order.warehouse?.name || "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (normalizedSearch.length === 0 || haystack.includes(normalizedSearch))
      );
    });
  }, [pickingOrders, search, statusFilter]);

  const filteredPackingRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return packingOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;
      const haystack = [
        order.fulfillmentCode,
        order.trackingNumber,
        order.customerName || "",
        order.tenant?.name || "",
        order.store?.name || "",
        order.packingStation?.name || "",
        order.packerUser?.name || "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (normalizedSearch.length === 0 || haystack.includes(normalizedSearch))
      );
    });
  }, [packingOrders, search, statusFilter]);

  const filteredDispatchRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return dispatchOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;
      const haystack = [
        order.fulfillmentCode,
        order.trackingNumber,
        order.customerName || "",
        order.tenant?.name || "",
        order.store?.name || "",
        order.packingStation?.name || "",
        order.packerUser?.name || "",
        order.posStatusName || "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (normalizedSearch.length === 0 || haystack.includes(normalizedSearch))
      );
    });
  }, [dispatchOrders, search, statusFilter]);

  const filteredStationRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return stations.filter((station) => {
      const matchesWarehouse =
        warehouseId === "ALL" || station.warehouse.id === warehouseId;
      const matchesStatus =
        statusFilter === "ALL" || station.status === statusFilter;
      const haystack = [
        station.code,
        station.name,
        station.warehouse.name,
        ...station.assignedUsers.map((user) => user.name || user.email),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesWarehouse &&
        matchesStatus &&
        (normalizedSearch.length === 0 || haystack.includes(normalizedSearch))
      );
    });
  }, [search, stations, statusFilter, warehouseId]);

  const currentRows =
    activeTab === "PICKING"
      ? filteredPickingRows
      : activeTab === "PACKING"
        ? filteredPackingRows
        : activeTab === "DISPATCH"
          ? filteredDispatchRows
        : filteredStationRows;

  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return currentRows.slice(start, start + pageSize);
  }, [currentRows, pageIndex, pageSize]);

  const selectedOrderPreview = useMemo(
    () =>
      [...pickingOrders, ...packingOrders, ...dispatchOrders].find(
        (order) => order.id === selectedOrderId,
      ) || null,
    [dispatchOrders, packingOrders, pickingOrders, selectedOrderId],
  );
  const selectedOrder = selectedOrderQuery.data || selectedOrderPreview;

  useEffect(() => {
    setPageIndex(0);
  }, [activeTab, search, statusFilter, tenantId, storeId, warehouseId]);

  useEffect(() => {
    setStatusFilter("ALL");
  }, [activeTab]);

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(currentRows.length / pageSize), 1);
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [currentRows.length, pageIndex, pageSize]);

  async function invalidateFulfillmentData(orderId?: string | null) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["wms-fulfillment-orders"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["wms-fulfillment-stations"],
      }),
      ...(orderId
        ? [
            queryClient.invalidateQueries({
              queryKey: ["wms-fulfillment-order", orderId],
            }),
          ]
        : []),
    ]);
  }

  const syncMutation = useMutation({
    mutationFn: () => syncWmsFulfillmentIntake(200),
    onSuccess: async (result) => {
      await invalidateFulfillmentData();
      setScreenError(null);
      setScreenMessage(
        `Intake synced: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    },
    onError: (error) => {
      setScreenMessage(null);
      setScreenError(
        error instanceof Error ? error.message : "Unable to sync intake.",
      );
    },
  });

  const createStationMutation = useMutation({
    mutationFn: (payload: CreateWmsPackingStationInput) =>
      createWmsPackingStation(payload),
    onSuccess: async () => {
      await invalidateFulfillmentData();
      setStationModalOpen(false);
      setEditingStation(null);
      setScreenError(null);
      setScreenMessage("Packing station created.");
    },
    onError: (error) => {
      setScreenMessage(null);
      setScreenError(
        error instanceof Error
          ? error.message
          : "Unable to create packing station.",
      );
    },
  });

  const updateStationMutation = useMutation({
    mutationFn: (payload: CreateWmsPackingStationInput) =>
      updateWmsPackingStation(editingStation?.id || "", payload),
    onSuccess: async () => {
      await invalidateFulfillmentData();
      setStationModalOpen(false);
      setEditingStation(null);
      setScreenError(null);
      setScreenMessage("Packing station updated.");
    },
    onError: (error) => {
      setScreenMessage(null);
      setScreenError(
        error instanceof Error
          ? error.message
          : "Unable to update packing station.",
      );
    },
  });

  const startPickingMutation = useMutation({
    mutationFn: (trackingNumber: string) =>
      startWmsFulfillmentPicking(selectedOrderId as string, trackingNumber),
  });
  const scanPickingMutation = useMutation({
    mutationFn: (unitBarcode: string) =>
      scanWmsFulfillmentPickUnit(selectedOrderId as string, unitBarcode),
  });
  const assignPackingMutation = useMutation({
    mutationFn: (payload: { stationId: string; packerUserId: string }) =>
      assignWmsFulfillmentPacking(selectedOrderId as string, payload),
  });
  const startPackingMutation = useMutation({
    mutationFn: (trackingNumber: string) =>
      startWmsFulfillmentPacking(selectedOrderId as string, trackingNumber),
  });
  const scanPackingMutation = useMutation({
    mutationFn: (unitBarcode: string) =>
      scanWmsFulfillmentPackUnit(selectedOrderId as string, unitBarcode),
  });
  const setStatusMutation = useMutation({
    mutationFn: (status: WmsFulfillmentOrderStatus) =>
      setWmsFulfillmentOrderStatus(selectedOrderId as string, status),
  });

  const anyWorkspaceMutationPending =
    startPickingMutation.isPending ||
    scanPickingMutation.isPending ||
    assignPackingMutation.isPending ||
    startPackingMutation.isPending ||
    scanPackingMutation.isPending ||
    setStatusMutation.isPending;

  function resetFilters() {
    setTenantId("");
    setStoreId("");
    setWarehouseId("ALL");
    setSearch("");
    setStatusFilter("ALL");
  }

  function openOrder(orderId: string, mode: WmsFulfillmentView) {
    setSelectedOrderId(orderId);
    setSelectedOrderMode(mode);
  }

  const loadingState =
    partnersQuery.isLoading ||
    filtersQuery.isLoading ||
    warehousesQuery.isLoading ||
    operatorsQuery.isLoading ||
    stationsQuery.isLoading ||
    pickingOrdersQuery.isLoading ||
    packingOrdersQuery.isLoading ||
    dispatchOrdersQuery.isLoading;

  const queryError =
    (partnersQuery.error as Error | null)?.message ||
    (filtersQuery.error as Error | null)?.message ||
    (warehousesQuery.error as Error | null)?.message ||
    (operatorsQuery.error as Error | null)?.message ||
    (stationsQuery.error as Error | null)?.message ||
    (pickingOrdersQuery.error as Error | null)?.message ||
    (packingOrdersQuery.error as Error | null)?.message ||
    (dispatchOrdersQuery.error as Error | null)?.message ||
    null;

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Fulfillment"
        eyebrow="Operator Flow"
        description="Picker and packing-station simulation for tracking-led ecommerce orders."
      />

      {screenError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {screenError}
        </div>
      ) : null}
      {screenMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {screenMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Picker Queue"
          value={statTotals.pickingQueue}
          icon={Truck}
        />
        <WmsStatCard
          label="Waiting Stock"
          value={statTotals.waitingStock}
          icon={ScanLine}
          accent="amber"
        />
        <WmsStatCard
          label="Packing Queue"
          value={statTotals.packingQueue}
          icon={PackageCheck}
          accent="orange"
        />
        <WmsStatCard
          label="Dispatch Queue"
          value={statTotals.dispatchQueue}
          icon={Truck}
          accent="emerald"
        />
      </div>

      <WmsSectionCard
        title={
          activeTab === "STATIONS"
            ? "Packing Stations"
            : activeTab === "DISPATCH"
              ? "Dispatch Queue"
              : "Fulfillment Queue"
        }
        metadata={
          <QueueTabs activeTab={activeTab} onChange={setActiveTab} />
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Partner"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setStoreId("");
              }}
              className="h-10 min-w-[176px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[188px]"
            >
              <option value="">Partner</option>
              {partners.map((partner: Partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Store"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              disabled={!tenantId}
              className="h-10 min-w-[210px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[240px]"
            >
              <option value="">Store</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.shopId})
                </option>
              ))}
            </select>

            <select
              aria-label="Warehouse"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="h-10 min-w-[190px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[210px]"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[180px]"
            >
              {activeTabStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search queue"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  activeTab === "STATIONS"
                    ? "Search station, warehouse, or operator"
                    : activeTab === "DISPATCH"
                      ? "Search tracking, partner, customer, or POS status"
                      : "Search request, tracking, partner, or customer"
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>

            {activeTab === "STATIONS" ? (
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => {
                  setEditingStation(null);
                  setStationModalOpen(true);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-500 bg-orange-500 px-3.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PackagePlus className="h-4 w-4" />
                New Station
              </button>
            ) : (
              <button
                type="button"
                disabled={!canWrite || syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-500 bg-orange-500 px-3.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PackagePlus className="h-4 w-4" />
                {syncMutation.isPending
                  ? "Syncing..."
                  : activeTab === "DISPATCH"
                    ? "Refresh Dispatch"
                    : "Sync Intake"}
              </button>
            )}
          </div>
        </div>

        {queryError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Fulfillment feed unavailable"
              description={queryError}
            />
          </div>
        ) : loadingState ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading fulfillment workspace"
              description="Preparing picker queue, packing queue, and station mappings."
            />
          </div>
        ) : currentRows.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title={
                activeTab === "STATIONS"
                  ? "No packing stations found"
                  : activeTab === "DISPATCH"
                    ? "No dispatch orders found"
                  : "No fulfillment orders found"
              }
              description={
                activeTab === "STATIONS"
                  ? "Create a packing station before handing orders to packers."
                  : activeTab === "DISPATCH"
                    ? "Packed or dispatched orders will appear here after the next sync."
                  : "Sync intake first or widen the queue filters."
              }
            />
          </div>
        ) : (
          <>
            {activeTab === "STATIONS" ? (
              <StationsTable
                rows={paginatedRows as WmsPackingStation[]}
                onEdit={(station) => {
                  setEditingStation(station);
                  setStationModalOpen(true);
                }}
              />
            ) : (
              <QueueTable
                mode={activeTab}
                rows={paginatedRows as WmsFulfillmentOrder[]}
                onOpen={openOrder}
              />
            )}

            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={currentRows.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </WmsSectionCard>

      <PackingStationModal
        open={stationModalOpen}
        station={editingStation}
        warehouses={warehouses}
        operators={operators}
        isSaving={
          createStationMutation.isPending || updateStationMutation.isPending
        }
        onClose={() => {
          setStationModalOpen(false);
          setEditingStation(null);
        }}
        onSubmit={async (payload) => {
          if (editingStation) {
            await updateStationMutation.mutateAsync(payload);
            return;
          }
          await createStationMutation.mutateAsync(payload);
        }}
      />

      <FulfillmentWorkspaceModal
        open={Boolean(selectedOrderId)}
        mode={selectedOrderMode}
        order={selectedOrder}
        stations={stations}
        isBusy={anyWorkspaceMutationPending || selectedOrderQuery.isFetching}
        onClose={() => {
          setSelectedOrderId(null);
        }}
        onStartPicking={async (trackingNumber) => {
          await startPickingMutation.mutateAsync(trackingNumber);
          await invalidateFulfillmentData(selectedOrderId);
        }}
        onScanPickUnit={async (unitBarcode) => {
          await scanPickingMutation.mutateAsync(unitBarcode);
          await invalidateFulfillmentData(selectedOrderId);
        }}
        onAssignPacking={async (payload) => {
          await assignPackingMutation.mutateAsync(payload);
          await invalidateFulfillmentData(selectedOrderId);
        }}
        onStartPacking={async (trackingNumber) => {
          await startPackingMutation.mutateAsync(trackingNumber);
          await invalidateFulfillmentData(selectedOrderId);
        }}
        onScanPackUnit={async (unitBarcode) => {
          await scanPackingMutation.mutateAsync(unitBarcode);
          await invalidateFulfillmentData(selectedOrderId);
        }}
        onSetStatus={async (status) => {
          await setStatusMutation.mutateAsync(status);
          await invalidateFulfillmentData(selectedOrderId);
        }}
      />
    </div>
  );
}
