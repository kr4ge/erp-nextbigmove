"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  RotateCcw,
  Search,
  ShoppingBag,
  Tags,
  Waypoints,
} from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { InventoryEmptyState } from "./inventory-empty-state";
import { InventoryProductsPagination } from "./inventory-products-pagination";
import { ProductsTable } from "./products-table";
import { SkuProfileModal } from "./sku-profile-modal";
import {
  deleteInventorySkuProfile,
  fetchInventoryPosProductFilters,
  fetchInventoryPosProducts,
  upsertInventorySkuProfile,
} from "../_services/inventory.service";
import type {
  UpsertWmsSkuProfileInput,
  WmsPosProductCatalogItem,
} from "../_types/inventory";
import { formatMoney } from "../_utils/inventory-format";

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

export function InventoryProductsScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileDraft, setProfileDraft] =
    useState<UpsertWmsSkuProfileInput>(EMPTY_PROFILE_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtersQuery = useQuery({
    queryKey: ["wms-inventory-pos-product-filters", tenantId],
    queryFn: () => fetchInventoryPosProductFilters(tenantId || undefined),
  });

  const productsQuery = useQuery({
    queryKey: ["wms-inventory-pos-products", tenantId, storeId, search],
    queryFn: () =>
      fetchInventoryPosProducts({
        tenantId: tenantId || undefined,
        storeId: storeId || undefined,
        search: search.trim() || undefined,
        limit: 1000,
      }),
  });

  const products = productsQuery.data || [];
  const filters = filtersQuery.data;
  const tenants = filters?.tenants || [];
  const shops = (filters?.shops || []).filter((shop) =>
    tenantId ? shop.tenantId === tenantId : true,
  );

  useEffect(() => {
    if (products.length === 0) {
      setSelectedProductId(null);
      return;
    }

    if (
      !selectedProductId ||
      !products.some((item) => item.id === selectedProductId)
    ) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const pageCount = Math.max(Math.ceil(products.length / pageSize), 1);

  const paginatedProducts = useMemo(() => {
    const start = pageIndex * pageSize;
    return products.slice(start, start + pageSize);
  }, [pageIndex, pageSize, products]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, tenantId, storeId]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(pageCount - 1, 0));
    }
  }, [pageCount, pageIndex]);

  useEffect(() => {
    setProfileDraft(buildProfileDraft(selectedProduct));
  }, [
    selectedProductId,
    selectedProduct?.skuProfile?.updatedAt,
    selectedProduct?.skuProfile?.id,
  ]);

  useEffect(() => {
    if (isProfileModalOpen && !selectedProduct) {
      setIsProfileModalOpen(false);
    }
  }, [isProfileModalOpen, selectedProduct]);

  const refreshProducts = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["wms-inventory-pos-products"],
    });
  };

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      upsertInventorySkuProfile(selectedProductId!, profileDraft),
    onSuccess: async () => {
      await refreshProducts();
      setMessage("SKU profile saved.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save SKU profile.",
      );
      setMessage(null);
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: () => deleteInventorySkuProfile(selectedProductId!),
    onSuccess: async () => {
      await refreshProducts();
      setMessage("SKU profile removed.");
      setError(null);
      setIsProfileModalOpen(false);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove SKU profile.",
      );
      setMessage(null);
    },
  });

  const profiledCount = products.filter((product) => product.skuProfile).length;
  const requestableCount = products.filter(
    (product) => product.skuProfile?.isRequestable,
  ).length;
  const serializedCount = products.filter(
    (product) => product.skuProfile?.isSerialized,
  ).length;
  const hasFilters = Boolean(search.trim() || tenantId || storeId);

  const openProfileModal = (productId: string) => {
    setSelectedProductId(productId);
    setIsProfileModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Products"
        description="Warehouse product profiles by store variation."
        eyebrow="Catalog"
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Variants"
          value={products.length}
          description="Visible POS rows"
          icon={Tags}
        />
        <WmsStatCard
          label="Profiled"
          value={profiledCount}
          description="Warehouse-ready"
          icon={Building2}
          accent="emerald"
        />
        <WmsStatCard
          label="Requestable"
          value={requestableCount}
          description="Ready for partner requests"
          icon={Waypoints}
          accent="amber"
        />
        <WmsStatCard
          label="Serialized"
          value={serializedCount}
          description="Unit-tracked variants"
          icon={ShoppingBag}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Product Directory"
        metadata={`${products.length} variants`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 xl:flex-[1.4]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or variation"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center">
              <select
                value={tenantId}
                onChange={(event) => {
                  setTenantId(event.target.value);
                  setStoreId("");
                }}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[210px]"
              >
                <option value="">All partners</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>

              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[240px]"
              >
                <option value="">All stores</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.shopId})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTenantId("");
                setStoreId("");
              }}
              disabled={!hasFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {productsQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading products"
              description="Fetching POS variants."
            />
          </div>
        ) : products.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No products found"
              description="Adjust tenant, shop, or search filters."
            />
          </div>
        ) : (
          <>
            <ProductsTable
              products={paginatedProducts}
              activeProductId={isProfileModalOpen ? selectedProductId : null}
              onManage={openProfileModal}
              formatMoney={formatMoney}
            />
            <InventoryProductsPagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={products.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(nextPageSize) => {
                setPageIndex(0);
                setPageSize(nextPageSize);
              }}
            />
          </>
        )}
      </WmsSectionCard>

      <SkuProfileModal
        open={isProfileModalOpen}
        product={selectedProduct}
        value={profileDraft}
        onChange={setProfileDraft}
        onClose={() => setIsProfileModalOpen(false)}
        onSubmit={() => saveProfileMutation.mutate()}
        onDelete={() => deleteProfileMutation.mutate()}
        isSaving={saveProfileMutation.isPending}
        isDeleting={deleteProfileMutation.isPending}
      />
    </div>
  );
}
