'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPinned, Pencil, Plus, Printer, Trash2, Warehouse } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import {
  WmsPrintLabelDescriptor,
  WmsPrintLabelModal,
} from '../../_components/wms-print-label-modal';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { hasAdminPermission } from '../../_utils/access';
import { EntityStatusBadge } from '../../warehouses/_components/entity-status-badge';
import { LocationForm } from '../../warehouses/_components/location-form';
import { WarehouseForm } from '../../warehouses/_components/warehouse-form';
import {
  createLocation,
  createWarehouse,
  deleteLocation,
  deleteWarehouse,
  fetchWarehouses,
  updateLocation,
  updateWarehouse,
} from '../../warehouses/_services/warehouses.service';
import type {
  LocationFormState,
  WmsLocation,
  WarehouseFormState,
  WmsWarehouse,
} from '../../warehouses/_types/warehouses';

const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  code: '',
  name: '',
  description: '',
  status: 'ACTIVE',
  isDefault: false,
  contactName: '',
  contactPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Philippines',
  notes: '',
};

const EMPTY_LOCATION_FORM: LocationFormState = {
  code: '',
  name: '',
  description: '',
  type: 'STORAGE',
  status: 'ACTIVE',
  isDefault: false,
  parentId: '',
  barcode: '',
  capacityUnits: '',
  sortOrder: '0',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function warehouseToForm(warehouse: WmsWarehouse): WarehouseFormState {
  return {
    code: warehouse.code,
    name: warehouse.name,
    description: warehouse.description || '',
    status: warehouse.status,
    isDefault: warehouse.isDefault,
    contactName: warehouse.contactName || '',
    contactPhone: warehouse.contactPhone || '',
    addressLine1: warehouse.addressLine1 || '',
    addressLine2: warehouse.addressLine2 || '',
    city: warehouse.city || '',
    province: warehouse.province || '',
    postalCode: warehouse.postalCode || '',
    country: warehouse.country || 'Philippines',
    notes: warehouse.notes || '',
  };
}

function locationToForm(location: WmsLocation): LocationFormState {
  return {
    code: location.code,
    name: location.name,
    description: location.description || '',
    type: location.type,
    status: location.status,
    isDefault: location.isDefault,
    parentId: location.parentId || '',
    barcode: location.barcode || '',
    capacityUnits: location.capacityUnits != null ? String(location.capacityUnits) : '',
    sortOrder: String(location.sortOrder ?? 0),
  };
}

export function WarehouseWorkspace() {
  const queryClient = useQueryClient();
  const warehousesQuery = useQuery({
    queryKey: ['wms-warehouses'],
    queryFn: fetchWarehouses,
  });

  const warehouses = useMemo(() => warehousesQuery.data || [], [warehousesQuery.data]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(EMPTY_WAREHOUSE_FORM);
  const [locationForm, setLocationForm] = useState<LocationFormState>(EMPTY_LOCATION_FORM);
  const [printLabel, setPrintLabel] = useState<WmsPrintLabelDescriptor | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedPermissions = localStorage.getItem('admin_permissions');

    try {
      const parsedUser = storedUser ? (JSON.parse(storedUser) as { role?: string }) : null;
      setUserRole(parsedUser?.role || null);
    } catch {
      setUserRole(null);
    }

    try {
      const parsedPermissions = storedPermissions ? JSON.parse(storedPermissions) : [];
      setPermissions(Array.isArray(parsedPermissions) ? parsedPermissions : []);
    } catch {
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    if (warehouses.length === 0) {
      setSelectedWarehouseId(null);
      return;
    }

    if (!selectedWarehouseId || !warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [selectedWarehouseId, warehouses]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) || null,
    [selectedWarehouseId, warehouses],
  );

  const canCreateWarehouse = hasAdminPermission(userRole, permissions, 'wms.warehouses.create');
  const canUpdateWarehouse = hasAdminPermission(userRole, permissions, 'wms.warehouses.update');
  const canDeleteWarehouse = hasAdminPermission(userRole, permissions, 'wms.warehouses.delete');
  const canManageWarehouseForm = canCreateWarehouse || canUpdateWarehouse;

  const resetWarehouseEditor = () => {
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
  };

  const resetLocationEditor = () => {
    setEditingLocationId(null);
    setLocationForm(EMPTY_LOCATION_FORM);
  };

  useEffect(() => {
    resetLocationEditor();
  }, [selectedWarehouseId]);

  const refreshWarehouses = async () => {
    await queryClient.invalidateQueries({ queryKey: ['wms-warehouses'] });
  };

  const createWarehouseMutation = useMutation({
    mutationFn: () => createWarehouse(warehouseForm),
    onSuccess: async (warehouse) => {
      await refreshWarehouses();
      setSelectedWarehouseId(warehouse.id);
      resetWarehouseEditor();
      setMessage('Warehouse saved.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to save warehouse.');
      setMessage(null);
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: () => updateWarehouse(editingWarehouseId!, warehouseForm),
    onSuccess: async (warehouse) => {
      await refreshWarehouses();
      setSelectedWarehouseId(warehouse.id);
      resetWarehouseEditor();
      setMessage('Warehouse updated.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update warehouse.');
      setMessage(null);
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (warehouseId: string) => deleteWarehouse(warehouseId),
    onSuccess: async () => {
      await refreshWarehouses();
      resetWarehouseEditor();
      setMessage('Warehouse removed.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to remove warehouse.');
      setMessage(null);
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: () => createLocation(selectedWarehouseId!, locationForm),
    onSuccess: async () => {
      await refreshWarehouses();
      resetLocationEditor();
      setMessage('Location saved.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to save location.');
      setMessage(null);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: () => updateLocation(selectedWarehouseId!, editingLocationId!, locationForm),
    onSuccess: async () => {
      await refreshWarehouses();
      resetLocationEditor();
      setMessage('Location updated.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update location.');
      setMessage(null);
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) => deleteLocation(selectedWarehouseId!, locationId),
    onSuccess: async () => {
      await refreshWarehouses();
      resetLocationEditor();
      setMessage('Location removed.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to remove location.');
      setMessage(null);
    },
  });

  const totalLocations = warehouses.reduce((sum, warehouse) => sum + warehouse.locationsCount, 0);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === 'ACTIVE').length;
  const parentOptions =
    selectedWarehouse?.locations.filter((location) => location.id !== editingLocationId) || [];
  const showLocationActions = Boolean(
    selectedWarehouse &&
      (canManageWarehouseForm ||
        canDeleteWarehouse ||
        selectedWarehouse.locations.some((location) => Boolean(location.barcode))),
  );

  const openLocationLabel = (warehouse: WmsWarehouse, location: WmsLocation) => {
    if (!location.barcode) {
      return;
    }

    setPrintLabel({
      eyebrow: 'Location Label',
      title: location.code,
      subtitle: location.name,
      barcode: location.barcode,
      fields: [
        { label: 'Warehouse', value: warehouse.name },
        { label: 'Type', value: location.type },
        { label: 'Status', value: location.status },
        {
          label: 'Parent',
          value: location.parentCode ? `${location.parentCode} · ${location.parentName}` : 'None',
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Warehouses"
        description="Sites and location map for stock movement."
        eyebrow="Inventory Structure"
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

      <div className="grid gap-4 xl:grid-cols-3">
        <WmsStatCard label="Warehouses" value={warehouses.length} description="Active operating sites" icon={Warehouse} />
        <WmsStatCard
          label="Live"
          value={activeWarehouses}
          description="Ready for inventory and fulfillment"
          icon={Building2}
          accent="emerald"
        />
        <WmsStatCard
          label="Locations"
          value={totalLocations}
          description="Bins, zones, and task points"
          icon={MapPinned}
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-6">
          <WmsSectionCard
            title="Warehouse Registry"
            icon={<Warehouse className="h-3.5 w-3.5" />}
            metadata={`${warehouses.length} records`}
          >
            {warehousesQuery.isLoading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading warehouses...</div>
            ) : warehouses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                No warehouse yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="pb-3 pr-6">Warehouse</th>
                      <th className="pb-3 pr-6">Code</th>
                      <th className="pb-3 pr-6">Status</th>
                      <th className="pb-3 pr-6">Locations</th>
                      <th className="pb-3 pr-6">City</th>
                      {canManageWarehouseForm || canDeleteWarehouse ? <th className="pb-3 text-right">Action</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {warehouses.map((warehouse) => {
                      const isSelected = selectedWarehouseId === warehouse.id;
                      return (
                        <tr
                          key={warehouse.id}
                          className={`cursor-pointer align-top transition-colors ${isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
                          onClick={() => setSelectedWarehouseId(warehouse.id)}
                        >
                          <td className="py-4 pr-6">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-950">{warehouse.name}</p>
                              {warehouse.isDefault ? (
                                <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{warehouse.addressLine1 || '—'}</p>
                          </td>
                          <td className="py-4 pr-6 text-sm font-medium text-slate-700">{warehouse.code}</td>
                          <td className="py-4 pr-6">
                            <EntityStatusBadge status={warehouse.status} />
                          </td>
                          <td className="py-4 pr-6 text-sm text-slate-600">
                            <span className="tabular-nums">{warehouse.locationsCount}</span>
                          </td>
                          <td className="py-4 pr-6 text-sm text-slate-500">{warehouse.city || '—'}</td>
                          {canManageWarehouseForm || canDeleteWarehouse ? (
                            <td className="py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {canUpdateWarehouse ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditingWarehouseId(warehouse.id);
                                      setWarehouseForm(warehouseToForm(warehouse));
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </button>
                                ) : null}
                                {canDeleteWarehouse ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!window.confirm(`Delete ${warehouse.name}?`)) {
                                        return;
                                      }
                                      deleteWarehouseMutation.mutate(warehouse.id);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </WmsSectionCard>

          <WmsSectionCard
            title="Locations"
            icon={<MapPinned className="h-3.5 w-3.5" />}
            metadata={selectedWarehouse ? `${selectedWarehouse.code} · ${selectedWarehouse.locationsCount}` : 'Select warehouse'}
          >
            {!selectedWarehouse ? (
              <div className="py-12 text-center text-sm text-slate-500">Select a warehouse.</div>
            ) : selectedWarehouse.locations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                No locations yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="pb-3 pr-6">Location</th>
                      <th className="pb-3 pr-6">Type</th>
                      <th className="pb-3 pr-6">Parent</th>
                      <th className="pb-3 pr-6">Status</th>
                      <th className="pb-3 pr-6">Updated</th>
                      {showLocationActions ? <th className="pb-3 text-right">Action</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedWarehouse.locations.map((location) => (
                      <tr key={location.id} className="align-top">
                        <td className="py-4 pr-6">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">{location.name}</p>
                            {location.isDefault ? (
                              <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{location.code}</p>
                        </td>
                        <td className="py-4 pr-6 text-sm font-medium text-slate-700">{location.type}</td>
                        <td className="py-4 pr-6 text-sm text-slate-500">
                          {location.parentCode ? `${location.parentCode} · ${location.parentName}` : '—'}
                        </td>
                        <td className="py-4 pr-6">
                          <EntityStatusBadge status={location.status} />
                        </td>
                        <td className="py-4 pr-6 text-sm text-slate-500">{formatDate(location.updatedAt)}</td>
                        {showLocationActions ? (
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {location.barcode ? (
                                <button
                                  type="button"
                                  onClick={() => openLocationLabel(selectedWarehouse, location)}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                                >
                                  <Printer className="h-4 w-4" />
                                  Print
                                </button>
                              ) : null}
                              {canUpdateWarehouse ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLocationId(location.id);
                                    setLocationForm(locationToForm(location));
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                              ) : null}
                              {canDeleteWarehouse ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!window.confirm(`Delete ${location.name}?`)) {
                                      return;
                                    }
                                    deleteLocationMutation.mutate(location.id);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WmsSectionCard>
        </div>

        <div className="space-y-6">
          <WmsSectionCard title="Warehouse" icon={<Plus className="h-3.5 w-3.5" />}>
            {canManageWarehouseForm ? (
              <WarehouseForm
                value={warehouseForm}
                title={editingWarehouseId ? 'Edit warehouse' : 'New warehouse'}
                submitLabel={editingWarehouseId ? 'Save Warehouse' : 'Create Warehouse'}
                isPending={createWarehouseMutation.isPending || updateWarehouseMutation.isPending}
                canSubmit={editingWarehouseId ? canUpdateWarehouse : canCreateWarehouse}
                onChange={(field, value) =>
                  setWarehouseForm((prev) => ({ ...prev, [field]: value }))
                }
                onSubmit={() => {
                  if (editingWarehouseId) {
                    updateWarehouseMutation.mutate();
                    return;
                  }
                  createWarehouseMutation.mutate();
                }}
                onCancel={editingWarehouseId ? resetWarehouseEditor : undefined}
              />
            ) : selectedWarehouse ? (
              <div className="space-y-4 text-sm text-slate-600">
                <div>
                  <p className="text-base font-semibold text-slate-950">{selectedWarehouse.name}</p>
                  <p className="mt-1">{selectedWarehouse.code}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                    <div className="mt-2">
                      <EntityStatusBadge status={selectedWarehouse.status} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Locations</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">
                      {selectedWarehouse.locationsCount}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">No access.</div>
            )}
          </WmsSectionCard>

          {selectedWarehouse ? (
            <WmsSectionCard title="Location" icon={<MapPinned className="h-3.5 w-3.5" />}>
              {canManageWarehouseForm ? (
                <LocationForm
                  value={locationForm}
                  title={editingLocationId ? `Edit in ${selectedWarehouse.code}` : `New in ${selectedWarehouse.code}`}
                  submitLabel={editingLocationId ? 'Save Location' : 'Create Location'}
                  isPending={createLocationMutation.isPending || updateLocationMutation.isPending}
                  canSubmit={editingLocationId ? canUpdateWarehouse : canCreateWarehouse}
                  parentOptions={parentOptions}
                  onChange={(field, value) =>
                    setLocationForm((prev) => ({ ...prev, [field]: value }))
                  }
                  onSubmit={() => {
                    if (editingLocationId) {
                      updateLocationMutation.mutate();
                      return;
                    }
                    createLocationMutation.mutate();
                  }}
                  onCancel={editingLocationId ? resetLocationEditor : undefined}
                />
              ) : (
                <div className="space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{selectedWarehouse.code}</p>
                    <p className="mt-1">{selectedWarehouse.activeLocationsCount} active locations</p>
                  </div>
                </div>
              )}
            </WmsSectionCard>
          ) : null}
        </div>
      </div>

      <WmsPrintLabelModal
        open={Boolean(printLabel)}
        label={printLabel}
        onClose={() => setPrintLabel(null)}
      />
    </div>
  );
}
