"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  ClipboardCheck,
  CreditCard,
  FileText,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { SkuProfileModal } from "../../inventory/_components/sku-profile-modal";
import {
  deleteInventorySkuProfile,
  fetchInventoryPosProductFilters,
  fetchInventoryPosProducts,
  upsertInventorySkuProfile,
} from "../../inventory/_services/inventory.service";
import type {
  UpsertWmsSkuProfileInput,
  WmsPosProductCatalogItem,
} from "../../inventory/_types/inventory";
import { fetchPartners } from "../../partners/_services/partners.service";
import { RequestCreatePane } from "./request-create-pane";
import { RequestStatusBadge } from "./request-status-badge";
import {
  auditWmsStockRequest,
  createWmsStockRequest,
  fetchWmsCompanyBillingSettings,
  fetchWmsForecasts,
  fetchWmsInvoices,
  fetchWmsPayments,
  fetchWmsStockRequest,
  fetchWmsStockRequests,
  markWmsStockRequestInProcurement,
  respondToWmsStockRequest,
  reviewWmsStockRequest,
  submitWmsStockRequest,
  startWmsStockRequestAudit,
  submitWmsStockRequestPayment,
  updateWmsStockRequest,
  upsertWmsCompanyBillingSettings,
  verifyWmsStockRequestPayment,
} from "../_services/requests.service";
import type {
  UpsertWmsCompanyBillingSettingsInput,
  WmsCompanyBillingSettings,
  WmsRequestStatus,
  WmsRequestType,
  WmsStockRequest,
} from "../_types/requests";

type RequestTabKey = "create" | "review" | "invoices" | "payments";

type SimulationQuantityMap = Record<string, number>;
type SimulationNotesMap = Record<string, string>;
type SimulationCostMap = Record<string, number>;
type PaymentRemarksMap = Record<string, string>;

const REQUEST_TABS: Array<{ key: RequestTabKey; label: string }> = [
  { key: "create", label: "Create Request" },
  { key: "review", label: "Review" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
];

const EMPTY_PROFILE_FORM: UpsertWmsSkuProfileInput = {
  code: "",
  category: "",
  unit: "",
  packSize: "",
  barcode: "",
  description: "",
  status: "ACTIVE",
  isSerialized: true,
  isLotTracked: false,
  isExpiryTracked: false,
  supplierCost: 0,
  wmsUnitPrice: 0,
  isRequestable: false,
};

function buildProfileDraft(product: WmsPosProductCatalogItem | null) {
  if (!product?.skuProfile) {
    return { ...EMPTY_PROFILE_FORM };
  }

  return {
    code: product.skuProfile.code || "",
    category: product.skuProfile.category || "",
    unit: product.skuProfile.unit || "",
    packSize: product.skuProfile.packSize || "",
    barcode: product.skuProfile.barcode || "",
    description: product.skuProfile.description || "",
    status: product.skuProfile.status,
    isSerialized: product.skuProfile.isSerialized,
    isLotTracked: product.skuProfile.isLotTracked,
    isExpiryTracked: product.skuProfile.isExpiryTracked,
    supplierCost: product.skuProfile.supplierCost || 0,
    wmsUnitPrice: product.skuProfile.wmsUnitPrice || 0,
    isRequestable: product.skuProfile.isRequestable,
  } satisfies UpsertWmsSkuProfileInput;
}

function formatMoney(value: number | null | undefined, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildBillingAddressLabel(
  address:
    | {
        line1: string;
        line2?: string | null;
        city: string;
        province?: string | null;
        postalCode?: string | null;
        country: string;
      }
    | null
    | undefined,
) {
  if (!address) {
    return "Not configured";
  }

  return [
    address.line1,
    address.line2,
    address.city,
    address.province,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function RequestTabs({
  activeTab,
  onChange,
}: {
  activeTab: RequestTabKey;
  onChange: (nextTab: RequestTabKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REQUEST_TABS.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold transition ${
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

function BillingSettingsForm({
  value,
  onChange,
  onSubmit,
  isSaving,
}: {
  value: UpsertWmsCompanyBillingSettingsInput;
  onChange: (next: UpsertWmsCompanyBillingSettingsInput) => void;
  onSubmit: () => void;
  isSaving: boolean;
}) {
  const inputClassName =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Company Name
          </span>
          <input
            value={value.companyName}
            onChange={(event) =>
              onChange({ ...value, companyName: event.target.value })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Billing Address
          </span>
          <input
            value={value.billingAddress.line1}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  line1: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Address Line 2
          </span>
          <input
            value={value.billingAddress.line2 || ""}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  line2: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            City
          </span>
          <input
            value={value.billingAddress.city}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  city: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Province
          </span>
          <input
            value={value.billingAddress.province || ""}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  province: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Postal Code
          </span>
          <input
            value={value.billingAddress.postalCode || ""}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  postalCode: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Country
          </span>
          <input
            value={value.billingAddress.country}
            onChange={(event) =>
              onChange({
                ...value,
                billingAddress: {
                  ...value.billingAddress,
                  country: event.target.value,
                },
              })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Bank
          </span>
          <input
            value={value.bankName || ""}
            onChange={(event) =>
              onChange({ ...value, bankName: event.target.value })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Account Name
          </span>
          <input
            value={value.bankAccountName || ""}
            onChange={(event) =>
              onChange({ ...value, bankAccountName: event.target.value })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Account Number
          </span>
          <input
            value={value.bankAccountNumber || ""}
            onChange={(event) =>
              onChange({ ...value, bankAccountNumber: event.target.value })
            }
            className={inputClassName}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Account Type
          </span>
          <input
            value={value.bankAccountType || ""}
            onChange={(event) =>
              onChange({ ...value, bankAccountType: event.target.value })
            }
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Notes
        </span>
        <textarea
          value={value.notes || ""}
          onChange={(event) =>
            onChange({ ...value, notes: event.target.value })
          }
          rows={3}
          className={`${inputClassName} min-h-[104px]`}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Billing Settings"}
        </button>
      </div>
    </div>
  );
}

export function RequestsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RequestTabKey>("create");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    WmsRequestStatus | "ALL"
  >("ALL");
  const [reviewPageIndex, setReviewPageIndex] = useState(0);
  const [reviewPageSize, setReviewPageSize] = useState(10);
  const [tenantId, setTenantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [simulationRequestType, setSimulationRequestType] =
    useState<WmsRequestType>("WMS_PROCUREMENT");
  const [forecastSearch, setForecastSearch] = useState("");
  const [simulationQuantities, setSimulationQuantities] =
    useState<SimulationQuantityMap>({});
  const [simulationNotes, setSimulationNotes] = useState<SimulationNotesMap>(
    {},
  );
  const [simulationDeclaredCosts, setSimulationDeclaredCosts] =
    useState<SimulationCostMap>({});
  const [orderingWindow, setOrderingWindow] = useState("Mon / Wed / Fri");
  const [simulationAdjustment, setSimulationAdjustment] = useState(0);
  const [simulationNotesText, setSimulationNotesText] = useState("");
  const [simulationEditingRequestId, setSimulationEditingRequestId] =
    useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [reviewAdjustment, setReviewAdjustment] = useState(0);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewLineState, setReviewLineState] = useState<
    Record<
      string,
      {
        isActive: boolean;
        requestedQuantity: number;
        supplierCost: number;
        wmsUnitPrice: number;
        reviewRemarks: string;
      }
    >
  >({});
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [auditRemarks, setAuditRemarks] = useState("");
  const [auditLineState, setAuditLineState] = useState<
    Record<
      string,
      {
        deliveredQuantity: number;
        acceptedQuantity: number;
        confirmedUnitCost: number;
        auditRemarks: string;
      }
    >
  >({});
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofNote, setPaymentProofNote] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState<PaymentRemarksMap>({});
  const [requestProfileProductId, setRequestProfileProductId] = useState<
    string | null
  >(null);
  const [isRequestProfileModalOpen, setIsRequestProfileModalOpen] =
    useState(false);
  const [requestProfileDraft, setRequestProfileDraft] =
    useState<UpsertWmsSkuProfileInput>(EMPTY_PROFILE_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingSettingsForm, setBillingSettingsForm] =
    useState<UpsertWmsCompanyBillingSettingsInput>({
      companyName: "",
      billingAddress: {
        line1: "",
        line2: "",
        city: "",
        province: "",
        postalCode: "",
        country: "Philippines",
      },
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankAccountType: "",
      notes: "",
    });

  const partnersQuery = useQuery({
    queryKey: ["wms-partners"],
    queryFn: fetchPartners,
  });

  const filtersQuery = useQuery({
    queryKey: ["wms-request-shop-filters", tenantId],
    queryFn: () => fetchInventoryPosProductFilters(tenantId || undefined),
  });

  const forecastsQuery = useQuery({
    queryKey: [
      "wms-forecasts",
      simulationRequestType,
      tenantId,
      storeId,
      forecastSearch,
      simulationRequestType === "WMS_PROCUREMENT" ? "requestable" : "all-products",
    ],
    queryFn: () =>
      fetchWmsForecasts({
        tenantId,
        storeId,
        search: forecastSearch || undefined,
        requestType: simulationRequestType,
        requestableOnly:
          simulationRequestType === "WMS_PROCUREMENT" ? true : false,
        profileOnly: false,
        limit: 300,
      }),
    enabled: Boolean(
      simulationRequestType === "WMS_PROCUREMENT" && tenantId && storeId,
    ),
  });

  const selfBuyProductsQuery = useQuery({
    queryKey: [
      "wms-self-buy-products",
      simulationRequestType,
      tenantId,
      storeId,
      forecastSearch,
    ],
    queryFn: () =>
      fetchInventoryPosProducts({
        tenantId,
        storeId,
        search: forecastSearch || undefined,
        profiledOnly: false,
        limit: 1000,
      }),
    enabled: Boolean(
      simulationRequestType === "PARTNER_SELF_BUY" && tenantId && storeId,
    ),
  });

  const stockRequestsQuery = useQuery({
    queryKey: ["wms-stock-requests"],
    queryFn: () => fetchWmsStockRequests({ limit: 100 }),
  });

  const selectedRequestQuery = useQuery({
    queryKey: ["wms-stock-request", selectedRequestId],
    queryFn: () => fetchWmsStockRequest(selectedRequestId!),
    enabled: Boolean(selectedRequestId),
  });

  const selectedRequest = selectedRequestQuery.data || null;
  const selectedRequestIsSelfBuy =
    selectedRequest?.requestType === "PARTNER_SELF_BUY";

  const selectedRequestProductsQuery = useQuery({
    queryKey: [
      "wms-request-review-products",
      selectedRequest?.id,
      selectedRequest?.tenant.id,
      selectedRequest?.store?.id || "",
    ],
    queryFn: () =>
      fetchInventoryPosProducts({
        tenantId: selectedRequest?.tenant.id || undefined,
        storeId: selectedRequest?.store?.id || undefined,
        limit: 1000,
      }),
    enabled: Boolean(
      selectedRequestIsSelfBuy &&
        selectedRequest?.tenant.id &&
        (selectedRequest?.store?.id || selectedRequest?.items.length),
    ),
  });

  const invoicesQuery = useQuery({
    queryKey: ["wms-invoices"],
    queryFn: () => fetchWmsInvoices({ limit: 100 }),
  });

  const paymentsQuery = useQuery({
    queryKey: ["wms-payments"],
    queryFn: () => fetchWmsPayments({ limit: 100 }),
  });

  const billingSettingsQuery = useQuery({
    queryKey: ["wms-company-billing-settings"],
    queryFn: fetchWmsCompanyBillingSettings,
  });

  const partners = partnersQuery.data || [];
  const shops = (filtersQuery.data?.shops || []).filter((shop) =>
    tenantId ? shop.tenantId === tenantId : true,
  );
  const forecasts = useMemo(() => {
    if (simulationRequestType === "PARTNER_SELF_BUY") {
      return (selfBuyProductsQuery.data || []).map((product) => ({
        id: product.id,
        productId: null,
        variationId: product.variationId,
        variationCustomId: product.variationCustomId,
        customId: product.customId,
        name: product.name,
        retailPrice: product.retailPrice,
        imageUrl: product.imageUrl,
        store: {
          id: product.store.id,
          name: product.store.name,
          shopId: product.store.shopId,
          shopName: product.store.shopName,
        },
        tenant: {
          id: product.store.tenant.id,
          name: product.store.tenant.name,
          slug: product.store.tenant.slug,
          companyName: null,
          billingAddress: null,
        },
        skuProfile: product.skuProfile
          ? {
              id: product.skuProfile.id,
              code: product.skuProfile.code,
              barcode: product.skuProfile.barcode,
              status: product.skuProfile.status,
              isSerialized: product.skuProfile.isSerialized,
              supplierCost: product.skuProfile.supplierCost,
              wmsUnitPrice: product.skuProfile.wmsUnitPrice,
              isRequestable: product.skuProfile.isRequestable,
            }
          : null,
        forecast: {
          runDate: new Date().toISOString().slice(0, 10),
          remainingStock: 0,
          pending: 0,
          pastTwoDays: 0,
          returning: 0,
          recommendedQuantity: 0,
          suggestedQuantity: 0,
        },
      }));
    }

    return forecastsQuery.data || [];
  }, [forecastsQuery.data, selfBuyProductsQuery.data, simulationRequestType]);

  const createGridError =
    simulationRequestType === "PARTNER_SELF_BUY"
      ? selfBuyProductsQuery.error
      : forecastsQuery.error;
  const stockRequests = stockRequestsQuery.data || [];
  const filteredReviewRequests = useMemo(() => {
    const normalizedSearch = reviewSearch.trim().toLowerCase();

    return stockRequests.filter((request) => {
      const matchesStatus =
        reviewStatusFilter === "ALL" || request.status === reviewStatusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        request.requestCode.toLowerCase().includes(normalizedSearch) ||
        request.tenant.name.toLowerCase().includes(normalizedSearch) ||
        (request.store?.name || "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [reviewSearch, reviewStatusFilter, stockRequests]);
  const paginatedReviewRequests = useMemo(() => {
    const start = reviewPageIndex * reviewPageSize;
    return filteredReviewRequests.slice(start, start + reviewPageSize);
  }, [filteredReviewRequests, reviewPageIndex, reviewPageSize]);
  const selectedRequestProducts = selectedRequestProductsQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const payments = paymentsQuery.data || [];
  const editingSimulationRequest =
    (simulationEditingRequestId
      ? (selectedRequest?.id === simulationEditingRequestId
          ? selectedRequest
          : stockRequests.find(
              (request) => request.id === simulationEditingRequestId,
            )) || null
      : null) || null;

  const requestableRows = useMemo(
    () =>
      forecasts.map((forecast) => ({
        ...forecast,
        requestedQuantity:
          simulationQuantities[forecast.id] ?? forecast.forecast.suggestedQuantity,
        partnerNotes: simulationNotes[forecast.id] || "",
        declaredUnitCost:
          simulationDeclaredCosts[forecast.id] ??
          forecast.skuProfile?.supplierCost ??
          0,
      })),
    [forecasts, simulationDeclaredCosts, simulationNotes, simulationQuantities],
  );

  const simulationSelectedRows = requestableRows.filter(
    (row) => row.requestedQuantity > 0,
  );
  const simulationSubtotal = simulationSelectedRows.reduce(
    (sum, row) =>
      sum +
      row.requestedQuantity *
        (simulationRequestType === "PARTNER_SELF_BUY"
          ? row.declaredUnitCost || 0
          : row.skuProfile?.wmsUnitPrice || 0),
    0,
  );
  const simulationUnits = simulationSelectedRows.reduce(
    (sum, row) => sum + row.requestedQuantity,
    0,
  );

  const reviewTotals = useMemo(() => {
    const lines = selectedRequest?.items || [];
    const subtotal = lines.reduce((sum, line) => {
      const state = reviewLineState[line.id];
      const isActive = state?.isActive ?? line.isActive;
      if (!isActive) {
        return sum;
      }

      return (
        sum +
        (state?.requestedQuantity ?? line.requestedQuantity) *
          (state?.wmsUnitPrice ?? line.wmsUnitPrice)
      );
    }, 0);

    return {
      subtotal,
      total: subtotal + reviewAdjustment,
    };
  }, [reviewAdjustment, reviewLineState, selectedRequest]);

  const auditTotals = useMemo(() => {
    const lines = selectedRequest?.items || [];
    const totalUnits = lines.reduce(
      (sum, line) =>
        sum +
        (auditLineState[line.id]?.acceptedQuantity ??
          line.acceptedQuantity ??
          0),
      0,
    );
    const totalValue = lines.reduce(
      (sum, line) =>
        sum +
        (auditLineState[line.id]?.acceptedQuantity ??
          line.acceptedQuantity ??
          0) *
          (auditLineState[line.id]?.confirmedUnitCost ??
            line.confirmedUnitCost ??
            line.declaredUnitCost ??
            0),
      0,
    );

    return { totalUnits, totalValue };
  }, [auditLineState, selectedRequest]);

  const pendingReviewCount = stockRequests.filter((request) =>
    [
      "SUBMITTED",
      "WMS_REVIEWED",
      "UNDER_AUDIT",
      "FEEDBACK_REQUIRED",
      "AUDIT_ACCEPTED",
      "PAYMENT_VERIFIED",
      "IN_PROCUREMENT",
      "PARTIALLY_RECEIVED",
    ].includes(request.status),
  ).length;
  const invoicedCount = stockRequests.filter(
    (request) => request.status === "INVOICED",
  ).length;
  const paymentSubmittedCount = payments.filter(
    (payment) => payment.status === "SUBMITTED",
  ).length;

  useEffect(() => {
    if (activeTab !== "review") {
      setSelectedRequestId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (
      selectedRequestId &&
      !stockRequests.some((request) => request.id === selectedRequestId)
    ) {
      setSelectedRequestId(null);
    }
  }, [selectedRequestId, stockRequests]);

  useEffect(() => {
    setReviewPageIndex(0);
  }, [reviewSearch, reviewStatusFilter]);

  useEffect(() => {
    const pageCount = Math.max(
      Math.ceil(filteredReviewRequests.length / reviewPageSize),
      1,
    );
    if (reviewPageIndex > pageCount - 1) {
      setReviewPageIndex(pageCount - 1);
    }
  }, [filteredReviewRequests.length, reviewPageIndex, reviewPageSize]);

  useEffect(() => {
    const nextQuantities: SimulationQuantityMap = {};
    const nextNotes: SimulationNotesMap = {};
    const nextCosts: SimulationCostMap = {};
    for (const forecast of forecasts) {
      nextQuantities[forecast.id] = forecast.forecast.suggestedQuantity;
      nextNotes[forecast.id] = "";
      nextCosts[forecast.id] = forecast.skuProfile?.supplierCost || 0;
    }

    if (
      editingSimulationRequest &&
      editingSimulationRequest.tenant.id === tenantId &&
      (editingSimulationRequest.store?.id || "") === storeId &&
      editingSimulationRequest.requestType === simulationRequestType
    ) {
      for (const item of editingSimulationRequest.items) {
        nextQuantities[item.posProductId] = item.requestedQuantity;
        nextNotes[item.posProductId] = item.partnerNotes || "";
        nextCosts[item.posProductId] =
          item.declaredUnitCost ?? nextCosts[item.posProductId] ?? 0;
      }
    }

    setSimulationQuantities(nextQuantities);
    setSimulationNotes(nextNotes);
    setSimulationDeclaredCosts(nextCosts);
  }, [
    editingSimulationRequest,
    simulationRequestType,
    tenantId,
    storeId,
    forecastsQuery.dataUpdatedAt,
    selfBuyProductsQuery.dataUpdatedAt,
  ]);

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    setReviewAdjustment(selectedRequest.adjustmentAmount || 0);
    setReviewRemarks(selectedRequest.reviewRemarks || "");
    setAuditRemarks(selectedRequest.reviewRemarks || "");
    setReviewLineState(
      Object.fromEntries(
        selectedRequest.items.map((item) => [
          item.id,
          {
            isActive: item.isActive,
            requestedQuantity: item.requestedQuantity,
            supplierCost: item.supplierCost || 0,
            wmsUnitPrice: item.wmsUnitPrice,
            reviewRemarks: item.reviewRemarks || "",
          },
        ]),
      ),
    );
    setAuditLineState(
      Object.fromEntries(
        selectedRequest.items.map((item) => [
          item.id,
          {
            deliveredQuantity: item.deliveredQuantity || item.requestedQuantity,
            acceptedQuantity:
              item.acceptedQuantity || item.deliveredQuantity || item.requestedQuantity,
            confirmedUnitCost:
              item.confirmedUnitCost ||
              item.declaredUnitCost ||
              item.supplierCost ||
              0,
            auditRemarks: item.auditRemarks || "",
          },
        ]),
      ),
    );
  }, [selectedRequest?.id]);

  useEffect(() => {
    if (!selectedRequestId || isRequestProfileModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRequestId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRequestId, isRequestProfileModalOpen]);

  useEffect(() => {
    if (!billingSettingsQuery.data) {
      return;
    }

    const settings = billingSettingsQuery.data;
    setBillingSettingsForm({
      companyName: settings.companyName,
      billingAddress: {
        line1: settings.billingAddress?.line1 || "",
        line2: settings.billingAddress?.line2 || "",
        city: settings.billingAddress?.city || "",
        province: settings.billingAddress?.province || "",
        postalCode: settings.billingAddress?.postalCode || "",
        country: settings.billingAddress?.country || "Philippines",
      },
      bankName: settings.bankName || "",
      bankAccountName: settings.bankAccountName || "",
      bankAccountNumber: settings.bankAccountNumber || "",
      bankAccountType: settings.bankAccountType || "",
      notes: settings.notes || "",
    });
  }, [billingSettingsQuery.dataUpdatedAt]);

  useEffect(() => {
    const invoicedRequest = stockRequests.find(
      (request) => request.status === "INVOICED",
    );
    if (invoicedRequest && !paymentRequestId) {
      setPaymentRequestId(invoicedRequest.id);
    }
  }, [paymentRequestId, stockRequests]);

  const refreshRequestDomain = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["wms-stock-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["wms-stock-request"] }),
      queryClient.invalidateQueries({ queryKey: ["wms-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["wms-payments"] }),
      queryClient.invalidateQueries({
        queryKey: ["wms-stock-receipts"],
      }),
    ]);
  };

  const refreshRequestProducts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["wms-request-review-products"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["wms-inventory-pos-products"],
      }),
    ]);
  };

  const createRequestMutation = useMutation({
    mutationFn: async (submit: boolean) => {
      const payload = {
        forecastRunDate: new Date().toISOString().slice(0, 10),
        orderingWindow,
        internalNotes: simulationNotesText || undefined,
        adjustmentAmount: simulationAdjustment || 0,
        items: simulationSelectedRows.map((row) => ({
          posProductId: row.id,
          requestedQuantity: row.requestedQuantity,
          recommendedQuantity: row.forecast.recommendedQuantity,
          remainingQuantity: row.forecast.remainingStock,
          pendingQuantity: row.forecast.pending,
          pastTwoDaysQuantity: row.forecast.pastTwoDays,
          returningQuantity: row.forecast.returning,
          declaredUnitCost:
            simulationRequestType === "PARTNER_SELF_BUY"
              ? row.declaredUnitCost || 0
              : undefined,
          partnerNotes: row.partnerNotes || undefined,
        })),
      };

      if (simulationEditingRequestId) {
        const updated = await updateWmsStockRequest(
          simulationEditingRequestId,
          payload,
        );

        if (!submit) {
          return updated;
        }

        return submitWmsStockRequest(updated.id);
      }

      return createWmsStockRequest({
        tenantId,
        storeId,
        requestType: simulationRequestType,
        currency: "PHP",
        submit,
        ...payload,
      });
    },
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setSimulationEditingRequestId(request.id);
      setActiveTab("review");
      setMessage(
        simulationEditingRequestId
          ? request.status === "SUBMITTED"
            ? `Request ${request.requestCode} updated and resubmitted.`
            : `Request ${request.requestCode} updated.`
          : request.status === "SUBMITTED"
            ? `Request ${request.requestCode} submitted.`
            : `Request ${request.requestCode} saved.`,
      );
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to create stock request.",
      );
      setMessage(null);
    },
  });

  const reviewRequestMutation = useMutation({
    mutationFn: () =>
      reviewWmsStockRequest(selectedRequestId!, {
        reviewRemarks: reviewRemarks || undefined,
        adjustmentAmount: reviewAdjustment,
        items: (selectedRequest?.items || []).map((item) => ({
          id: item.id,
          isActive: reviewLineState[item.id]?.isActive ?? item.isActive,
          requestedQuantity:
            reviewLineState[item.id]?.requestedQuantity ?? item.requestedQuantity,
          supplierCost:
            reviewLineState[item.id]?.supplierCost ?? item.supplierCost ?? 0,
          wmsUnitPrice:
            reviewLineState[item.id]?.wmsUnitPrice ?? item.wmsUnitPrice,
          reviewRemarks:
            reviewLineState[item.id]?.reviewRemarks || undefined,
        })),
      }),
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setMessage(`Request ${request.requestCode} reviewed.`);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to review stock request.",
      );
      setMessage(null);
    },
  });

  const startAuditMutation = useMutation({
    mutationFn: () => startWmsStockRequestAudit(selectedRequestId!),
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setMessage(`Audit started for ${request.requestCode}.`);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to start request audit.",
      );
      setMessage(null);
    },
  });

  const auditRequestMutation = useMutation({
    mutationFn: (action: "ACCEPT" | "FEEDBACK") =>
      auditWmsStockRequest(selectedRequestId!, {
        action,
        auditRemarks: auditRemarks || undefined,
        items: (selectedRequest?.items || []).map((item) => ({
          id: item.id,
          deliveredQuantity:
            auditLineState[item.id]?.deliveredQuantity ??
            item.deliveredQuantity ??
            item.requestedQuantity,
          acceptedQuantity:
            auditLineState[item.id]?.acceptedQuantity ??
            item.acceptedQuantity ??
            item.requestedQuantity,
          confirmedUnitCost:
            auditLineState[item.id]?.confirmedUnitCost ??
            item.confirmedUnitCost ??
            item.declaredUnitCost ??
            0,
          auditRemarks: auditLineState[item.id]?.auditRemarks || undefined,
        })),
      }),
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setMessage(
        request.status === "AUDIT_ACCEPTED"
          ? `Audit accepted for ${request.requestCode}.`
          : `Feedback sent for ${request.requestCode}.`,
      );
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to complete request audit.",
      );
      setMessage(null);
    },
  });

  const respondRequestMutation = useMutation({
    mutationFn: (action: "CONFIRM" | "REJECT") =>
      respondToWmsStockRequest(selectedRequestId!, {
        action,
      }),
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setMessage(
        request.status === "INVOICED"
          ? `Request ${request.requestCode} confirmed and invoiced.`
          : `Request ${request.requestCode} rejected.`,
      );
      setError(null);
      if (request.status === "INVOICED") {
        setActiveTab("payments");
      }
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to send partner response.",
      );
      setMessage(null);
    },
  });

  const procurementMutation = useMutation({
    mutationFn: () => markWmsStockRequestInProcurement(selectedRequestId!),
    onSuccess: async (request) => {
      await refreshRequestDomain();
      setSelectedRequestId(request.id);
      setMessage(`Request ${request.requestCode} moved into procurement.`);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to move request into procurement.",
      );
      setMessage(null);
    },
  });

  const saveBillingMutation = useMutation({
    mutationFn: () => upsertWmsCompanyBillingSettings(billingSettingsForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["wms-company-billing-settings"],
      });
      setMessage("WMS billing settings saved.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save WMS billing settings.",
      );
      setMessage(null);
    },
  });

  const submitPaymentMutation = useMutation({
    mutationFn: () =>
      submitWmsStockRequestPayment(paymentRequestId, {
        proofUrl: paymentProofUrl,
        proofNote: paymentProofNote || undefined,
      }),
    onSuccess: async () => {
      await refreshRequestDomain();
      setPaymentProofUrl("");
      setPaymentProofNote("");
      setMessage("Payment proof submitted.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to submit payment proof.",
      );
      setMessage(null);
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: ({
      paymentId,
      approve,
    }: {
      paymentId: string;
      approve: boolean;
    }) =>
      verifyWmsStockRequestPayment(paymentId, {
        approve,
        remarks: paymentRemarks[paymentId] || undefined,
      }),
    onSuccess: async (payment) => {
      await refreshRequestDomain();
      setMessage(
        payment.status === "VERIFIED"
          ? "Payment proof verified."
          : "Payment proof rejected.",
      );
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to verify payment proof.",
      );
      setMessage(null);
    },
  });

  const saveRequestProfileMutation = useMutation({
    mutationFn: () =>
      upsertInventorySkuProfile(requestProfileProductId!, requestProfileDraft),
    onSuccess: async () => {
      await Promise.all([refreshRequestProducts(), refreshRequestDomain()]);
      setMessage("Warehouse profile saved.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save warehouse profile.",
      );
      setMessage(null);
    },
  });

  const deleteRequestProfileMutation = useMutation({
    mutationFn: () => deleteInventorySkuProfile(requestProfileProductId!),
    onSuccess: async () => {
      await Promise.all([refreshRequestProducts(), refreshRequestDomain()]);
      setMessage("Warehouse profile removed.");
      setError(null);
      setIsRequestProfileModalOpen(false);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove warehouse profile.",
      );
      setMessage(null);
    },
  });

  const selectedRequestProductsById = useMemo(
    () => new Map(selectedRequestProducts.map((product) => [product.id, product])),
    [selectedRequestProducts],
  );
  const selectedRequestProfileProduct = useMemo(
    () =>
      (requestProfileProductId
        ? selectedRequestProductsById.get(requestProfileProductId)
        : null) || null,
    [requestProfileProductId, selectedRequestProductsById],
  );

  const selfBuyLinesMissingProfile = useMemo(() => {
    if (!selectedRequestIsSelfBuy || !selectedRequest) {
      return [];
    }

    return selectedRequest.items.filter((item) => {
      const product = selectedRequestProductsById.get(item.posProductId);
      return !product?.skuProfile || product.skuProfile.status !== "ACTIVE";
    });
  }, [selectedRequest, selectedRequestIsSelfBuy, selectedRequestProductsById]);

  const selfBuyAcceptedLinesMissingProfile = useMemo(() => {
    if (!selectedRequestIsSelfBuy || !selectedRequest) {
      return [];
    }

    return selectedRequest.items.filter((item) => {
      const acceptedQuantity =
        auditLineState[item.id]?.acceptedQuantity ??
        item.acceptedQuantity ??
        item.requestedQuantity;
      if (acceptedQuantity <= 0) {
        return false;
      }

      const product = selectedRequestProductsById.get(item.posProductId);
      return !product?.skuProfile || product.skuProfile.status !== "ACTIVE";
    });
  }, [
    auditLineState,
    selectedRequest,
    selectedRequestIsSelfBuy,
    selectedRequestProductsById,
  ]);

  useEffect(() => {
    setRequestProfileDraft(buildProfileDraft(selectedRequestProfileProduct));
  }, [
    requestProfileProductId,
    selectedRequestProfileProduct?.skuProfile?.updatedAt,
    selectedRequestProfileProduct?.skuProfile?.id,
  ]);

  useEffect(() => {
    if (isRequestProfileModalOpen && !selectedRequestProfileProduct) {
      setIsRequestProfileModalOpen(false);
    }
  }, [isRequestProfileModalOpen, selectedRequestProfileProduct]);

  function resetSimulationWorkspace() {
    setSimulationEditingRequestId(null);
    setSimulationRequestType("WMS_PROCUREMENT");
    setForecastSearch("");
    setSimulationAdjustment(0);
    setSimulationNotesText("");
    setOrderingWindow("Mon / Wed / Fri");
  }

  function openRequestInSimulation(request: WmsStockRequest) {
    setSimulationEditingRequestId(request.id);
    setSelectedRequestId(request.id);
    setSimulationRequestType(request.requestType);
    setTenantId(request.tenant.id);
    setStoreId(request.store?.id || "");
    setOrderingWindow(request.orderingWindow || "Mon / Wed / Fri");
    setSimulationAdjustment(request.adjustmentAmount || 0);
    setSimulationNotesText(request.internalNotes || "");
    setForecastSearch("");
    setActiveTab("create");
    setMessage(null);
    setError(null);
  }

  function openRequestProductProfile(productId: string) {
    setRequestProfileProductId(productId);
    setIsRequestProfileModalOpen(true);
    setMessage(null);
    setError(null);
  }

  function resetReviewWorkspace() {
    setReviewSearch("");
    setReviewStatusFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Stock Requests"
        description="Inbound requests, review, billing, and receiving."
        eyebrow="Inbound Flow"
        actions={
          <RequestTabs activeTab={activeTab} onChange={setActiveTab} />
        }
      />

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Draft Rows"
          value={forecasts.length}
          description="Visible request candidates"
          icon={ClipboardCheck}
        />
        <WmsStatCard
          label="Review Queue"
          value={pendingReviewCount}
          description="Requests needing action"
          icon={PackageCheck}
          accent="amber"
        />
        <WmsStatCard
          label="Invoiced"
          value={invoicedCount}
          description="Requests awaiting payment"
          icon={FileText}
          accent="orange"
        />
        <WmsStatCard
          label="Payments"
          value={paymentSubmittedCount}
          description="Proofs pending verification"
          icon={CreditCard}
          accent="emerald"
        />
      </div>

      {activeTab === "create" ? (
        <RequestCreatePane
          partners={partners}
          shops={shops}
          requestType={simulationRequestType}
          tenantId={tenantId}
          storeId={storeId}
          search={forecastSearch}
          rows={requestableRows}
          editingRequest={editingSimulationRequest}
          loading={
            simulationRequestType === "PARTNER_SELF_BUY"
              ? selfBuyProductsQuery.isLoading
              : forecastsQuery.isLoading
          }
          error={
            createGridError instanceof Error
              ? createGridError.message
              : createGridError
                ? "Unable to load request candidates."
                : null
          }
          totalAmount={simulationSubtotal + simulationAdjustment}
          activeLineCount={simulationSelectedRows.length}
          isSaving={createRequestMutation.isPending}
          onRequestTypeChange={setSimulationRequestType}
          onTenantChange={(value) => {
            setTenantId(value);
            setStoreId("");
          }}
          onStoreChange={setStoreId}
          onSearchChange={setForecastSearch}
          onQuantityChange={(rowId, value) =>
            setSimulationQuantities((current) => ({
              ...current,
              [rowId]: value,
            }))
          }
          onDeclaredCostChange={(rowId, value) =>
            setSimulationDeclaredCosts((current) => ({
              ...current,
              [rowId]: value,
            }))
          }
          onReset={resetSimulationWorkspace}
          onOpenNewRequest={() => {
            setSimulationEditingRequestId(null);
            setSimulationAdjustment(0);
            setSimulationNotesText("");
            setOrderingWindow("Mon / Wed / Fri");
          }}
          onSaveDraft={() => createRequestMutation.mutate(false)}
          onSubmit={() => createRequestMutation.mutate(true)}
          formatMoney={formatMoney}
        />
      ) : null}

      {activeTab === "review" ? (
        <>
          <WmsSectionCard
            title="Request Queue"
            metadata={`${filteredReviewRequests.length} requests`}
            bodyClassName="p-0"
          >
            <div className="border-b border-slate-100 px-3 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 xl:flex-[1.1]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={reviewSearch}
                    onChange={(event) => setReviewSearch(event.target.value)}
                    placeholder="Search request, partner, or store"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <select
                  value={reviewStatusFilter}
                  onChange={(event) =>
                    setReviewStatusFilter(
                      event.target.value as WmsRequestStatus | "ALL",
                    )
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[220px]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="WMS_REVIEWED">WMS Reviewed</option>
                  <option value="UNDER_AUDIT">Under Audit</option>
                  <option value="FEEDBACK_REQUIRED">Feedback Required</option>
                  <option value="AUDIT_ACCEPTED">Audit Accepted</option>
                  <option value="INVOICED">Invoiced</option>
                  <option value="PAYMENT_VERIFIED">Payment Verified</option>
                  <option value="IN_PROCUREMENT">In Procurement</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                  <option value="RECEIVED">Received</option>
                </select>

                <button
                  type="button"
                  onClick={resetReviewWorkspace}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>

            {filteredReviewRequests.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm text-slate-500">
                No requests found.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="border-y border-slate-200 bg-slate-50/70">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-4 py-3.5">Request</th>
                        <th className="px-4 py-3.5">Partner</th>
                        <th className="px-4 py-3.5">Store</th>
                        <th className="px-4 py-3.5 text-center">Type</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                        <th className="px-4 py-3.5 text-right">Total</th>
                        <th className="px-4 py-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedReviewRequests.map((request) => {
                        const active = request.id === selectedRequestId;

                        return (
                          <tr
                            key={request.id}
                            className={`align-top transition hover:bg-slate-50/80 ${
                              active ? "bg-orange-50/70" : ""
                            }`}
                          >
                            <td className="px-4 py-4">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-950">
                                  {request.requestCode}
                                </div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {request.totalQuantity} units • {request.totalItems} lines
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {request.tenant.name}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {request.store?.name || "No store"}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-flex items-center whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                {request.requestType === "PARTNER_SELF_BUY"
                                  ? "Self-Buy"
                                  : "Procurement"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <RequestStatusBadge status={request.status} />
                            </td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                              {formatMoney(request.totalAmount, request.currency)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedRequestId(request.id)}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <WmsTablePagination
                  pageIndex={reviewPageIndex}
                  pageSize={reviewPageSize}
                  pageSizeOptions={[10, 25, 50]}
                  totalItems={filteredReviewRequests.length}
                  onPageIndexChange={setReviewPageIndex}
                  onPageSizeChange={(nextPageSize) => {
                    setReviewPageSize(nextPageSize);
                    setReviewPageIndex(0);
                  }}
                />
              </>
            )}
          </WmsSectionCard>

          {selectedRequestId ? (
            <div className="fixed inset-0 z-40" aria-modal="true" role="dialog">
              <div
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]"
                onClick={() => setSelectedRequestId(null)}
              />
              <div className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
                <div className="mx-auto flex min-h-full max-w-7xl items-center justify-center">
                  <div className="flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                          Request Review
                        </div>
                        <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950">
                          {selectedRequest?.requestCode || "Loading request"}
                        </h2>
                        {selectedRequest ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                            <span>{selectedRequest.tenant.companyName || selectedRequest.tenant.name}</span>
                            {selectedRequest.store ? (
                              <span>{selectedRequest.store.name}</span>
                            ) : null}
                            <span>
                              {selectedRequest.requestType === "PARTNER_SELF_BUY"
                                ? "Partner Self-Buy"
                                : "WMS Procurement"}
                            </span>
                            <span className="font-semibold tabular-nums text-slate-950">
                              {formatMoney(selectedRequest.totalAmount, selectedRequest.currency)}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {selectedRequest ? (
                          <RequestStatusBadge status={selectedRequest.status} />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedRequestId(null)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 overflow-y-auto bg-slate-50/40">
                      {selectedRequestQuery.isLoading ? (
                        <div className="px-6 py-16 text-center text-sm text-slate-500">
                          Loading request...
                        </div>
                      ) : selectedRequestQuery.error ? (
                        <div className="px-6 py-16 text-center">
                          <div className="text-sm text-rose-600">
                            {selectedRequestQuery.error instanceof Error
                              ? selectedRequestQuery.error.message
                              : "Unable to load request."}
                          </div>
                          <button
                            type="button"
                            onClick={() => selectedRequestQuery.refetch()}
                            className="mt-4 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                          >
                            Retry
                          </button>
                        </div>
                      ) : !selectedRequest ? (
                        <div className="px-6 py-16 text-center text-sm text-slate-500">
                          Request not found.
                        </div>
                      ) : (
                        <div className="space-y-6 p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                              {selectedRequest.totalItems} lines
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                              {selectedRequest.totalQuantity} units
                            </span>
                            {selectedRequest.reviewRemarks ? (
                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                                Feedback on file
                              </span>
                            ) : null}
                          </div>

                          {selectedRequestIsSelfBuy ? (
                            <>
                              <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
                                <table className="min-w-full table-fixed text-sm">
                                  <colgroup>
                                    <col className="w-[34%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[13%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[14%]" />
                                  </colgroup>
                                  <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    <tr>
                                      <th className="px-4 py-3.5">Product</th>
                                      <th className="px-4 py-3.5 text-right">Requested</th>
                                      <th className="px-4 py-3.5 text-right">Delivered</th>
                                      <th className="px-4 py-3.5 text-right">Accepted</th>
                                      <th className="px-4 py-3.5 text-right">Confirmed COGS</th>
                                      <th className="px-4 py-3.5 text-right">Received</th>
                                      <th className="px-4 py-3.5 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {selectedRequest.items.map((item) => {
                                      const lineState = auditLineState[item.id];
                                      const requestProduct =
                                        selectedRequestProductsById.get(item.posProductId) ||
                                        null;
                                      const hasActiveProfile = Boolean(
                                        requestProduct?.skuProfile &&
                                          requestProduct.skuProfile.status === "ACTIVE",
                                      );
                                      const isEditable =
                                        selectedRequest.status === "UNDER_AUDIT";
                                      const deliveredQuantity =
                                        lineState?.deliveredQuantity ??
                                        item.deliveredQuantity ??
                                        item.requestedQuantity;
                                      const acceptedQuantity =
                                        lineState?.acceptedQuantity ??
                                        item.acceptedQuantity ??
                                        item.requestedQuantity;
                                      const confirmedUnitCost =
                                        lineState?.confirmedUnitCost ??
                                        item.confirmedUnitCost ??
                                        item.declaredUnitCost ??
                                        0;
                                      const lineAmount =
                                        acceptedQuantity * confirmedUnitCost;

                                      return (
                                        <tr key={item.id} className="align-top">
                                          <td className="px-4 py-4">
                                            <div className="font-semibold text-slate-950">
                                              {item.productName}
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                                {item.variationCustomId || "No variation ref"}
                                              </span>
                                              <span
                                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                                  hasActiveProfile
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                                }`}
                                              >
                                                {hasActiveProfile
                                                  ? "Profile Ready"
                                                  : "Profile Missing"}
                                              </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                              Declared {formatMoney(item.declaredUnitCost)}
                                            </div>
                                            <div className="mt-3">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  openRequestProductProfile(item.posProductId)
                                                }
                                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                                              >
                                                {hasActiveProfile
                                                  ? "Edit Profile"
                                                  : "Configure Product"}
                                              </button>
                                            </div>
                                          </td>
                                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                                            {item.requestedQuantity}
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={deliveredQuantity}
                                                onChange={(event) =>
                                                  setAuditLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      deliveredQuantity:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="font-semibold tabular-nums text-slate-950">
                                                {item.deliveredQuantity}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={acceptedQuantity}
                                                onChange={(event) =>
                                                  setAuditLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      acceptedQuantity:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="font-semibold tabular-nums text-slate-950">
                                                {item.acceptedQuantity}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={confirmedUnitCost}
                                                onChange={(event) =>
                                                  setAuditLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      confirmedUnitCost:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="tabular-nums text-slate-700">
                                                {formatMoney(
                                                  item.confirmedUnitCost ||
                                                    item.declaredUnitCost,
                                                )}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                                            {item.receivedQuantity}
                                          </td>
                                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                                            {formatMoney(lineAmount)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {["SUBMITTED", "FEEDBACK_REQUIRED"].includes(
                                selectedRequest.status,
                              ) ? (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                  <div className="space-y-1">
                                    <div className="text-sm text-slate-600">
                                      {selectedRequest.status === "FEEDBACK_REQUIRED"
                                        ? "Partner can revise this self-buy request, or WMS can restart audit after the corrected delivery arrives."
                                        : "Start warehouse audit when the partner-delivered stock arrives for counting and COGS confirmation."}
                                    </div>
                                    {selectedRequest.reviewRemarks ? (
                                      <div className="text-sm text-slate-500">
                                        Feedback: {selectedRequest.reviewRemarks}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    {selectedRequest.status === "FEEDBACK_REQUIRED" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openRequestInSimulation(selectedRequest)
                                        }
                                        className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                                      >
                                        Edit as Partner
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => startAuditMutation.mutate()}
                                      disabled={startAuditMutation.isPending}
                                      className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {startAuditMutation.isPending
                                        ? "Starting..."
                                        : "Start Audit"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {selectedRequest.status === "UNDER_AUDIT" ? (
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                                    {selfBuyAcceptedLinesMissingProfile.length > 0 ? (
                                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                                        Configure an active warehouse profile for all accepted lines before audit can be accepted.
                                      </div>
                                    ) : null}
                                    <label className="block space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Audit Remarks
                                      </span>
                                      <textarea
                                        value={auditRemarks}
                                        onChange={(event) =>
                                          setAuditRemarks(event.target.value)
                                        }
                                        rows={4}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                                      />
                                    </label>
                                    <div className="flex flex-wrap justify-end gap-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          auditRequestMutation.mutate("FEEDBACK")
                                        }
                                        disabled={auditRequestMutation.isPending}
                                        className="inline-flex items-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Send Feedback
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          auditRequestMutation.mutate("ACCEPT")
                                        }
                                        disabled={
                                          auditRequestMutation.isPending ||
                                          selfBuyAcceptedLinesMissingProfile.length >
                                            0
                                        }
                                        className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {auditRequestMutation.isPending
                                          ? "Saving..."
                                          : "Accept Audit"}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      Audit Totals
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">
                                          Accepted Units
                                        </span>
                                        <span className="font-semibold tabular-nums text-slate-950">
                                          {auditTotals.totalUnits}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">
                                          Confirmed Value
                                        </span>
                                        <span className="font-semibold tabular-nums text-slate-950">
                                          {formatMoney(
                                            auditTotals.totalValue,
                                            selectedRequest.currency,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {selectedRequest.status === "AUDIT_ACCEPTED" ? (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                                  Audit is accepted. This self-buy request can now drive automatic inbound receiving.
                                </div>
                              ) : null}

                              {["AUDIT_ACCEPTED", "PARTIALLY_RECEIVED"].includes(
                                selectedRequest.status,
                              ) ? (
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                  {selfBuyLinesMissingProfile.length > 0 ? (
                                    <div className="space-y-3">
                                      <div className="text-sm text-rose-700">
                                        Configure an active warehouse profile for each accepted product before opening stock receiving.
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {selfBuyLinesMissingProfile.map((item) => (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                              openRequestProductProfile(
                                                item.posProductId,
                                              )
                                            }
                                            className="inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-50"
                                          >
                                            Configure{" "}
                                            {item.variationCustomId ||
                                              item.productName}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-sm text-slate-600">
                                        Receive accepted partner-delivered stock into warehouse inventory.
                                      </div>
                                      <div className="mt-3">
                                        <Link
                                          href={`/purchasing/receipts?requestId=${selectedRequest.id}`}
                                          className="inline-flex items-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                                        >
                                          Open Stock Receiving
                                        </Link>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
                                <table className="min-w-full table-fixed text-sm">
                                  <colgroup>
                                    <col className="w-[34%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[12%]" />
                                    {selectedRequest.status === "SUBMITTED" ? (
                                      <col className="w-[10%]" />
                                    ) : null}
                                  </colgroup>
                                  <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    <tr>
                                      <th className="px-4 py-3.5">Product</th>
                                      <th className="px-4 py-3.5 text-right">Requested</th>
                                      <th className="px-4 py-3.5 text-right">Supplier</th>
                                      <th className="px-4 py-3.5 text-right">WMS</th>
                                      <th className="px-4 py-3.5 text-right">Received</th>
                                      <th className="px-4 py-3.5 text-right">Amount</th>
                                      {selectedRequest.status === "SUBMITTED" ? (
                                        <th className="px-4 py-3.5 text-center">Active</th>
                                      ) : null}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {selectedRequest.items.map((item) => {
                                      const lineState = reviewLineState[item.id];
                                      const requestedQuantity =
                                        lineState?.requestedQuantity ??
                                        item.requestedQuantity;
                                      const supplierCost =
                                        lineState?.supplierCost ??
                                        item.supplierCost ??
                                        0;
                                      const wmsUnitPrice =
                                        lineState?.wmsUnitPrice ?? item.wmsUnitPrice;
                                      const lineAmount =
                                        requestedQuantity * wmsUnitPrice;
                                      const isEditable =
                                        selectedRequest.status === "SUBMITTED";

                                      return (
                                        <tr key={item.id} className="align-top">
                                          <td className="px-4 py-4">
                                            <div className="font-semibold text-slate-950">
                                              {item.productName}
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                                {item.variationCustomId || "No variation ref"}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={requestedQuantity}
                                                onChange={(event) =>
                                                  setReviewLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      requestedQuantity:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="font-semibold tabular-nums text-slate-950">
                                                {item.requestedQuantity}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={supplierCost}
                                                onChange={(event) =>
                                                  setReviewLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      supplierCost:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="tabular-nums text-slate-700">
                                                {formatMoney(item.supplierCost)}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right">
                                            {isEditable ? (
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={wmsUnitPrice}
                                                onChange={(event) =>
                                                  setReviewLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      wmsUnitPrice:
                                                        Number(event.target.value) || 0,
                                                    },
                                                  }))
                                                }
                                                className="ml-auto w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                                              />
                                            ) : (
                                              <span className="tabular-nums text-slate-700">
                                                {formatMoney(item.wmsUnitPrice)}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                                            {item.receivedQuantity}
                                          </td>
                                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                                            {formatMoney(lineAmount)}
                                          </td>
                                          {selectedRequest.status === "SUBMITTED" ? (
                                            <td className="px-4 py-4 text-center">
                                              <input
                                                type="checkbox"
                                                checked={
                                                  lineState?.isActive ?? item.isActive
                                                }
                                                onChange={(event) =>
                                                  setReviewLineState((current) => ({
                                                    ...current,
                                                    [item.id]: {
                                                      ...current[item.id],
                                                      isActive:
                                                        event.target.checked,
                                                    },
                                                  }))
                                                }
                                              />
                                            </td>
                                          ) : null}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {selectedRequest.status === "SUBMITTED" ? (
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                                    <label className="block space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Review Remarks
                                      </span>
                                      <textarea
                                        value={reviewRemarks}
                                        onChange={(event) =>
                                          setReviewRemarks(event.target.value)
                                        }
                                        rows={4}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                                      />
                                    </label>
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          reviewRequestMutation.mutate()
                                        }
                                        disabled={reviewRequestMutation.isPending}
                                        className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {reviewRequestMutation.isPending
                                          ? "Reviewing..."
                                          : "Send Review"}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      Pricing Totals
                                    </div>
                                    <label className="mt-4 block space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Adjustment
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={reviewAdjustment}
                                        onChange={(event) =>
                                          setReviewAdjustment(
                                            Number(event.target.value) || 0,
                                          )
                                        }
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                                      />
                                    </label>
                                    <div className="mt-4 space-y-2 text-sm">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">
                                          Subtotal
                                        </span>
                                        <span className="font-semibold tabular-nums text-slate-950">
                                          {formatMoney(
                                            reviewTotals.subtotal,
                                            selectedRequest.currency,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Total</span>
                                        <span className="font-semibold tabular-nums text-slate-950">
                                          {formatMoney(
                                            reviewTotals.total,
                                            selectedRequest.currency,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {selectedRequest.status === "WMS_REVIEWED" ? (
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondRequestMutation.mutate("CONFIRM")
                                    }
                                    disabled={respondRequestMutation.isPending}
                                    className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Confirm as Partner
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondRequestMutation.mutate("REJECT")
                                    }
                                    disabled={respondRequestMutation.isPending}
                                    className="inline-flex items-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reject as Partner
                                  </button>
                                </div>
                              ) : null}

                              {selectedRequest.status === "INVOICED" ? (
                                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-800">
                                  Invoice is ready. Submit payment proof in the Payments tab to continue the inbound flow.
                                </div>
                              ) : null}

                              {selectedRequest.status === "PAYMENT_VERIFIED" ? (
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      procurementMutation.mutate()
                                    }
                                    disabled={procurementMutation.isPending}
                                    className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {procurementMutation.isPending
                                      ? "Updating..."
                                      : "Mark In Procurement"}
                                  </button>
                                </div>
                              ) : null}

                              {[
                                "PAYMENT_VERIFIED",
                                "IN_PROCUREMENT",
                                "PARTIALLY_RECEIVED",
                              ].includes(selectedRequest.status) ? (
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                  <div className="text-sm text-slate-600">
                                    This request can now drive automatic inbound receiving.
                                  </div>
                                  <div className="mt-3">
                                    <Link
                                      href={`/purchasing/receipts?requestId=${selectedRequest.id}`}
                                      className="inline-flex items-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                                    >
                                      Open Stock Receiving
                                    </Link>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}

                          {selectedRequest.invoice ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Invoice
                                  </div>
                                  <div className="mt-2 text-base font-semibold text-slate-950">
                                    {selectedRequest.invoice.invoiceCode}
                                  </div>
                                </div>
                                <RequestStatusBadge
                                  status={selectedRequest.invoice.status}
                                  kind="invoice"
                                />
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Company
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-950">
                                    {selectedRequest.invoice.companyName}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {buildBillingAddressLabel(
                                      selectedRequest.invoice.companyBillingAddress,
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Partner Bill To
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-950">
                                    {selectedRequest.invoice.partnerCompanyName}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {buildBillingAddressLabel(
                                      selectedRequest.invoice.partnerBillingAddress,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "invoices" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <WmsSectionCard title="Invoice Feed" metadata={`${invoices.length} invoices`}>
            {invoices.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm text-slate-500">
                No invoices yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Partner</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-950">
                            {invoice.invoiceCode}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {invoice.request.requestCode}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {invoice.tenant.name}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-4 py-4 font-semibold tabular-nums text-slate-950">
                          {formatMoney(invoice.totalAmount, invoice.currency)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <RequestStatusBadge
                            status={invoice.status}
                            kind="invoice"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WmsSectionCard>

          <WmsSectionCard
            title="WMS Billing Settings"
            icon={<Banknote className="h-3.5 w-3.5" />}
          >
            <BillingSettingsForm
              value={billingSettingsForm}
              onChange={setBillingSettingsForm}
              onSubmit={() => saveBillingMutation.mutate()}
              isSaving={saveBillingMutation.isPending}
            />
          </WmsSectionCard>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <WmsSectionCard
            title="Submit Payment Proof"
            metadata={`${stockRequests.filter((request) => request.status === "INVOICED").length} open invoices`}
          >
            <div className="space-y-4">
              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Request
                </span>
                <select
                  value={paymentRequestId}
                  onChange={(event) => setPaymentRequestId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="">Select invoiced request</option>
                  {stockRequests
                    .filter((request) => request.status === "INVOICED")
                    .map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.requestCode} · {request.tenant.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Proof URL
                </span>
                <input
                  value={paymentProofUrl}
                  onChange={(event) => setPaymentProofUrl(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Note
                </span>
                <textarea
                  value={paymentProofNote}
                  onChange={(event) => setPaymentProofNote(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <button
                type="button"
                disabled={
                  !paymentRequestId ||
                  !paymentProofUrl ||
                  submitPaymentMutation.isPending
                }
                onClick={() => submitPaymentMutation.mutate()}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitPaymentMutation.isPending
                  ? "Submitting..."
                  : "Submit Proof"}
              </button>
            </div>
          </WmsSectionCard>

          <WmsSectionCard title="Payment Feed" metadata={`${payments.length} proofs`}>
            {payments.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm text-slate-500">
                No payment proof yet.
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {payment.request?.requestCode || "Request"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {payment.request?.tenant.name || "Partner"} ·{" "}
                          {payment.invoice?.invoiceCode || "No invoice"}
                        </div>
                      </div>
                      <RequestStatusBadge
                        status={payment.status}
                        kind="payment"
                      />
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
                      <div className="space-y-2 text-sm text-slate-600">
                        <div>
                          Submitted {formatDate(payment.submittedAt)}
                        </div>
                        {payment.proofUrl ? (
                          <Link
                            href={payment.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-700 underline-offset-2 hover:underline"
                          >
                            Open proof
                          </Link>
                        ) : null}
                        <div>{payment.proofNote || "No note"}</div>
                      </div>
                      <div className="space-y-3">
                        <textarea
                          value={paymentRemarks[payment.id] || ""}
                          onChange={(event) =>
                            setPaymentRemarks((current) => ({
                              ...current,
                              [payment.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Verification remarks"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                        />
                        {payment.status === "SUBMITTED" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                verifyPaymentMutation.mutate({
                                  paymentId: payment.id,
                                  approve: true,
                                })
                              }
                              disabled={verifyPaymentMutation.isPending}
                              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                verifyPaymentMutation.mutate({
                                  paymentId: payment.id,
                                  approve: false,
                                })
                              }
                              disabled={verifyPaymentMutation.isPending}
                              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            {payment.verifiedAt
                              ? `Resolved ${formatDate(payment.verifiedAt)}`
                              : "Already resolved"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WmsSectionCard>
        </div>
      ) : null}

      <SkuProfileModal
        open={isRequestProfileModalOpen}
        product={selectedRequestProfileProduct}
        value={requestProfileDraft}
        onChange={setRequestProfileDraft}
        onClose={() => setIsRequestProfileModalOpen(false)}
        onSubmit={() => saveRequestProfileMutation.mutate()}
        onDelete={() => deleteRequestProfileMutation.mutate()}
        isSaving={saveRequestProfileMutation.isPending}
        isDeleting={deleteRequestProfileMutation.isPending}
      />
    </div>
  );
}
