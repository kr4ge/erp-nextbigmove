'use client';

import { useEffect, useState } from 'react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsModal } from '../../_components/wms-modal';
import type {
  CreateWmsWarehouseInput,
  WmsWarehouseDetail,
  WmsWarehouseStatus,
} from '../_types/warehouse';

type WarehouseFormModalProps = {
  open: boolean;
  warehouse: WmsWarehouseDetail | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWmsWarehouseInput) => Promise<void>;
};

type WarehouseFormState = {
  code: string;
  name: string;
  description: string;
  address: string;
  billingCompanyName: string;
  billingAddress: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankBranch: string;
  paymentInstructions: string;
  status: WmsWarehouseStatus;
  autoSeedOperationalLocations: boolean;
};

const DEFAULT_STATE: WarehouseFormState = {
  code: '',
  name: '',
  description: '',
  address: '',
  billingCompanyName: '',
  billingAddress: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankAccountType: '',
  bankBranch: '',
  paymentInstructions: '',
  status: 'ACTIVE',
  autoSeedOperationalLocations: true,
};

export function WarehouseFormModal({
  open,
  warehouse,
  isSubmitting,
  onClose,
  onSubmit,
}: WarehouseFormModalProps) {
  const [state, setState] = useState<WarehouseFormState>(DEFAULT_STATE);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (warehouse) {
      setState({
        code: warehouse.code,
        name: warehouse.name,
        description: warehouse.description ?? '',
        address: warehouse.address ?? '',
        billingCompanyName: warehouse.billingCompanyName ?? '',
        billingAddress: warehouse.billingAddress ?? '',
        bankName: warehouse.bankName ?? '',
        bankAccountName: warehouse.bankAccountName ?? '',
        bankAccountNumber: warehouse.bankAccountNumber ?? '',
        bankAccountType: warehouse.bankAccountType ?? '',
        bankBranch: warehouse.bankBranch ?? '',
        paymentInstructions: warehouse.paymentInstructions ?? '',
        status: warehouse.status,
        autoSeedOperationalLocations: true,
      });
      return;
    }

    setState(DEFAULT_STATE);
  }, [open, warehouse]);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="wms-pill-control rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={isSubmitting || !state.code || !state.name}
        onClick={async () => {
          await onSubmit({
            code: state.code,
            name: state.name,
            description: state.description || undefined,
            address: state.address || undefined,
            billingCompanyName: state.billingCompanyName || undefined,
            billingAddress: state.billingAddress || undefined,
            bankName: state.bankName || undefined,
            bankAccountName: state.bankAccountName || undefined,
            bankAccountNumber: state.bankAccountNumber || undefined,
            bankAccountType: state.bankAccountType || undefined,
            bankBranch: state.bankBranch || undefined,
            paymentInstructions: state.paymentInstructions || undefined,
            status: state.status,
            autoSeedOperationalLocations: warehouse ? undefined : state.autoSeedOperationalLocations,
          });
        }}
        className="wms-pill-control rounded-full bg-[#12384b] px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Saving...' : warehouse ? 'Save warehouse' : 'Create warehouse'}
      </button>
    </div>
  );

  return (
    <WmsModal
      open={open}
      onClose={onClose}
      title={warehouse ? 'Edit warehouse' : 'New warehouse'}
      description="Create the physical warehouse record and seed its default operational zones."
      footer={footer}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <WmsFormField label="Warehouse code">
          <input
            value={state.code}
            onChange={(event) => setState((current) => ({ ...current, code: event.target.value }))}
            className="wms-input w-full"
            placeholder="MNL-01"
          />
        </WmsFormField>

        <WmsFormField label="Name">
          <input
            value={state.name}
            onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
            className="wms-input w-full"
            placeholder="Main Warehouse"
          />
        </WmsFormField>

        <WmsFormField label="Status">
          <select
            value={state.status}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                status: event.target.value as WmsWarehouseStatus,
              }))
            }
            className="wms-select w-full"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </WmsFormField>

        {!warehouse ? (
          <div className="rounded-[24px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 md:col-span-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Default zones</p>
            <label className="mt-2 flex items-center gap-3 text-sm text-[#12384b]">
              <input
                type="checkbox"
                checked={state.autoSeedOperationalLocations}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    autoSeedOperationalLocations: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-[#c8d5de] text-[#12384b]"
              />
              Seed receiving, packing, dispatch, RTS, damage, and quarantine zones
            </label>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <WmsFormField label="Description">
            <textarea
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              className="wms-textarea w-full"
              rows={3}
              placeholder="Operational scope, servicing notes, or area tags"
            />
          </WmsFormField>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Address">
            <textarea
              value={state.address}
              onChange={(event) => setState((current) => ({ ...current, address: event.target.value }))}
              className="wms-textarea w-full"
              rows={2}
              placeholder="Physical warehouse address"
            />
          </WmsFormField>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Billing company">
            <input
              value={state.billingCompanyName}
              onChange={(event) =>
                setState((current) => ({ ...current, billingCompanyName: event.target.value }))
              }
              className="wms-input w-full"
              placeholder="Company name for invoice receipt"
            />
          </WmsFormField>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Billing address">
            <textarea
              value={state.billingAddress}
              onChange={(event) =>
                setState((current) => ({ ...current, billingAddress: event.target.value }))
              }
              className="wms-textarea w-full"
              rows={2}
              placeholder="Invoice billing address"
            />
          </WmsFormField>
        </div>

        <WmsFormField label="Bank name">
          <input
            value={state.bankName}
            onChange={(event) => setState((current) => ({ ...current, bankName: event.target.value }))}
            className="wms-input w-full"
            placeholder="UnionBank"
          />
        </WmsFormField>

        <WmsFormField label="Bank account name">
          <input
            value={state.bankAccountName}
            onChange={(event) =>
              setState((current) => ({ ...current, bankAccountName: event.target.value }))
            }
            className="wms-input w-full"
            placeholder="WETRADE DIGITAL VENTURES INC."
          />
        </WmsFormField>

        <WmsFormField label="Bank account number">
          <input
            value={state.bankAccountNumber}
            onChange={(event) =>
              setState((current) => ({ ...current, bankAccountNumber: event.target.value }))
            }
            className="wms-input w-full"
            placeholder="0021-8002-6773"
          />
        </WmsFormField>

        <WmsFormField label="Account type">
          <input
            value={state.bankAccountType}
            onChange={(event) =>
              setState((current) => ({ ...current, bankAccountType: event.target.value }))
            }
            className="wms-input w-full"
            placeholder="Checking Account"
          />
        </WmsFormField>

        <div className="md:col-span-2">
          <WmsFormField label="Bank branch / notes">
            <textarea
              value={state.bankBranch}
              onChange={(event) =>
                setState((current) => ({ ...current, bankBranch: event.target.value }))
              }
              className="wms-textarea w-full"
              rows={2}
              placeholder="Branch details (optional)"
            />
          </WmsFormField>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Payment instructions">
            <textarea
              value={state.paymentInstructions}
              onChange={(event) =>
                setState((current) => ({ ...current, paymentInstructions: event.target.value }))
              }
              className="wms-textarea w-full"
              rows={2}
              placeholder="Additional instructions for partner payment"
            />
          </WmsFormField>
        </div>
      </div>
    </WmsModal>
  );
}
