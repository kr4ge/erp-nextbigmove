'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { ReceivingBatchModal } from '../../receiving/_components/receiving-batch-modal';
import { usePurchasingReceivingBridge } from '../_hooks/use-purchasing-receiving-bridge';
import { fetchWmsInvoiceDocument } from '../_services/purchasing.service';
import { usePurchasingController } from '../_hooks/use-purchasing-controller';
import { usePurchasingInvoiceController } from '../_hooks/use-purchasing-invoice-controller';
import { printInvoiceDocument } from '../_utils/invoice-print';
import { PurchasingBatchModal } from './purchasing-batch-modal';
import { PurchasingBatchesTable } from './purchasing-batches-table';
import { PurchasingFilterBar } from './purchasing-filter-bar';
import { PurchasingInvoiceEditorModal } from './purchasing-invoice-editor-modal';
import { PurchasingInvoiceFilterBar } from './purchasing-invoice-filter-bar';
import { PurchasingInvoiceModal } from './purchasing-invoice-modal';
import { PurchasingInvoicesTable } from './purchasing-invoices-table';

const NOTICE_AUTO_DISMISS_MS = 5000;

export function PurchasingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'requests' | 'invoices'>('requests');
  const [invoicePrintError, setInvoicePrintError] = useState<string | null>(null);
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);
  const controller = usePurchasingController();
  const invoiceController = usePurchasingInvoiceController(activeTab === 'invoices');
  const pagination = controller.overview?.pagination;
  const paginationTotal = pagination?.total ?? 0;
  const paginationPageSize = pagination?.pageSize ?? (controller.overview?.batches.length ?? 0);
  const paginationStart = paginationTotal === 0 ? 0 : ((controller.currentPage - 1) * paginationPageSize) + 1;
  const paginationEnd = paginationTotal === 0
    ? 0
    : Math.min(paginationTotal, paginationStart + (controller.overview?.batches.length ?? 0) - 1);
  const receivingBridge = usePurchasingReceivingBridge({
    batch: controller.selectedBatch,
    tenantId: controller.selectedTenantId,
    canPostReceiving: controller.canPostReceiving,
    onCreated: (receivingBatchId) => {
      controller.closeBatch();
      router.push(`/inventory/stock-receiving?printBatch=${receivingBatchId}`);
    },
  });
  const invoicePagination = invoiceController.overview?.pagination;
  const invoicePaginationTotal = invoicePagination?.total ?? 0;
  const invoicePaginationPageSize = invoicePagination?.pageSize ?? (invoiceController.overview?.invoices.length ?? 0);
  const invoicePaginationStart = invoicePaginationTotal === 0
    ? 0
    : ((invoiceController.currentPage - 1) * invoicePaginationPageSize) + 1;
  const invoicePaginationEnd = invoicePaginationTotal === 0
    ? 0
    : Math.min(
        invoicePaginationTotal,
        invoicePaginationStart + (invoiceController.overview?.invoices.length ?? 0) - 1,
      );

  useEffect(() => {
    const tab = searchParams.get('tab');
    const invoiceId = searchParams.get('invoiceId');
    const tenantId = searchParams.get('tenantId');

    if (tab === 'invoices' || invoiceId) {
      setActiveTab('invoices');
    }

    if (tenantId) {
      invoiceController.setSelectedTenantId(tenantId);
    }

    if (invoiceId) {
      invoiceController.openInvoice(invoiceId);
    }
  }, [
    invoiceController,
    searchParams,
  ]);

  const handlePrintInvoice = async (invoiceId: string) => {
    if (isPrintingInvoice) {
      return;
    }

    setInvoicePrintError(null);
    setIsPrintingInvoice(true);

    try {
      const documentPayload = await fetchWmsInvoiceDocument(
        invoiceId,
        invoiceController.selectedTenantId,
      );
      printInvoiceDocument(documentPayload);
    } catch (error) {
      setInvoicePrintError(getErrorMessage(error));
    } finally {
      setIsPrintingInvoice(false);
    }
  };

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Purchasing"
        toolbarClassName="px-0 py-0"
        toolbar={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto lg:flex-1">
              <nav className="flex min-w-max gap-6 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'requests'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Requests
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'invoices'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Invoices
                </button>
              </nav>
            </div>

            {activeTab === 'invoices' && invoiceController.canEdit ? (
              <button
                type="button"
                onClick={invoiceController.openCreateModal}
                className="btn btn-md btn-primary self-start lg:self-auto"
              >
                <Plus className="h-4 w-4" />
                New manual invoice
              </button>
            ) : null}
          </div>
        )}
      >
        {activeTab === 'requests' && controller.banner ? (
          <WmsInlineNotice
            tone={controller.banner.tone}
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
            onDismiss={controller.clearBanner}
          >
            {controller.banner.message}
          </WmsInlineNotice>
        ) : null}

        {activeTab === 'requests' && controller.errorMessage ? (
          <WmsInlineNotice
            tone="error"
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
          >
            {controller.errorMessage}
          </WmsInlineNotice>
        ) : null}

        {activeTab === 'invoices' && invoiceController.banner ? (
          <WmsInlineNotice
            tone={invoiceController.banner.tone}
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
            onDismiss={invoiceController.clearBanner}
          >
            {invoiceController.banner.message}
          </WmsInlineNotice>
        ) : null}

        {activeTab === 'invoices' && invoiceController.errorMessage ? (
          <WmsInlineNotice
            tone="error"
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
          >
            {invoiceController.errorMessage}
          </WmsInlineNotice>
        ) : null}

        {activeTab === 'invoices' && invoicePrintError ? (
          <WmsInlineNotice
            tone="error"
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
            onDismiss={() => setInvoicePrintError(null)}
          >
            {invoicePrintError}
          </WmsInlineNotice>
        ) : null}

        {activeTab === 'requests' ? (
          <WmsWorkspaceCard
            title="Requests"
            icon={<Clipboard className='panel-icon' />}
            filters={(
              <PurchasingFilterBar
                filters={controller.overview?.filters}
                searchText={controller.searchText}
                onSearchTextChange={controller.setSearchText}
                selectedTenantId={controller.selectedTenantId}
                onTenantChange={controller.setSelectedTenantId}
                selectedStoreId={controller.selectedStoreId}
                onStoreChange={controller.setSelectedStoreId}
                selectedRequestType={controller.selectedRequestType}
                onRequestTypeChange={controller.setSelectedRequestType}
                selectedStatus={controller.selectedStatus}
                onStatusChange={controller.setSelectedStatus}
              />
            )}
            footer={(
              <PaginationFooter
                start={paginationStart}
                end={paginationEnd}
                total={paginationTotal}
                page={pagination?.page ?? 1}
                totalPages={pagination?.totalPages ?? 1}
                onPrevious={() => controller.setCurrentPage(controller.currentPage - 1)}
                onNext={() => controller.setCurrentPage(controller.currentPage + 1)}
                disablePrevious={controller.currentPage <= 1}
                disableNext={controller.currentPage >= (pagination?.totalPages ?? 1)}
              />
            )}
          >
            <PurchasingBatchesTable
              batches={controller.overview?.batches ?? []}
              isLoading={controller.isLoading}
              tenantReady={controller.overview?.tenantReady ?? false}
              onOpenBatch={controller.openBatch}
            />
          </WmsWorkspaceCard>
        ) : (
          <WmsWorkspaceCard
            title="Invoices"
            icon={<FileSpreadsheet className="panel-icon" />}
            filters={(
              <PurchasingInvoiceFilterBar
                filters={invoiceController.overview?.filters}
                searchText={invoiceController.searchText}
                onSearchTextChange={invoiceController.setSearchText}
                selectedTenantId={invoiceController.selectedTenantId}
                onTenantChange={invoiceController.setSelectedTenantId}
                selectedSourceType={invoiceController.selectedSourceType}
                onSourceTypeChange={invoiceController.setSelectedSourceType}
                selectedStatus={invoiceController.selectedStatus}
                onStatusChange={invoiceController.setSelectedStatus}
              />
            )}
            footer={(
              <PaginationFooter
                start={invoicePaginationStart}
                end={invoicePaginationEnd}
                total={invoicePaginationTotal}
                page={invoicePagination?.page ?? 1}
                totalPages={invoicePagination?.totalPages ?? 1}
                onPrevious={() => invoiceController.setCurrentPage(invoiceController.currentPage - 1)}
                onNext={() => invoiceController.setCurrentPage(invoiceController.currentPage + 1)}
                disablePrevious={invoiceController.currentPage <= 1}
                disableNext={invoiceController.currentPage >= (invoicePagination?.totalPages ?? 1)}
              />
            )}
          >
            {invoiceController.overview?.tenantReady ? (
              <div className="grid gap-3 border-b border-[#eef2f5] p-4 md:grid-cols-2 xl:grid-cols-4">
                <InvoiceSummaryCard
                  label="Total billed"
                  value={formatMoney(invoiceController.overview.summary.totalBilledAmount)}
                  hint={`${invoiceController.overview.summary.invoices} invoices`}
                />
                <InvoiceSummaryCard
                  label="Amount due"
                  value={formatMoney(invoiceController.overview.summary.totalAmountDue)}
                  hint={`${invoiceController.overview.summary.issued + invoiceController.overview.summary.paidPendingVerify} open`}
                />
                <InvoiceSummaryCard
                  label="Paid verified"
                  value={formatMoney(invoiceController.overview.summary.paidVerifiedAmount)}
                  hint={`${invoiceController.overview.summary.paidVerified} verified`}
                />
                <InvoiceSummaryCard
                  label="Canceled"
                  value={formatMoney(invoiceController.overview.summary.canceledAmount)}
                  hint={`${invoiceController.overview.summary.canceled} canceled`}
                />
              </div>
            ) : null}

            <PurchasingInvoicesTable
              invoices={invoiceController.overview?.invoices ?? []}
              isLoading={invoiceController.isLoading}
              tenantReady={invoiceController.overview?.tenantReady ?? false}
              onOpenInvoice={invoiceController.openInvoice}
            />
          </WmsWorkspaceCard>
        )}
      </WmsPageShell>

      <PurchasingBatchModal
        open={controller.isBatchOpen}
        batch={controller.selectedBatch}
        isLoading={controller.isLoadingBatch}
        canEdit={controller.canEdit}
        canCreateReceiving={receivingBridge.canCreateReceiving}
        isUpdatingStatus={controller.isUpdatingStatus}
        isUpdatingLine={controller.isUpdatingLine}
        isCreatingReceiving={receivingBridge.receivingModal.isSubmitting}
        isEnsuringInvoice={invoiceController.isEnsuringInvoice}
        onClose={controller.closeBatch}
        onApplyStatus={controller.applyStatus}
        onUpdateLine={controller.updateLine}
        onCreateReceiving={receivingBridge.receivingModal.openModal}
        onOpenLinkedInvoice={(invoiceId) => {
          setActiveTab('invoices');
          invoiceController.setSelectedTenantId(controller.selectedTenantId);
          invoiceController.openInvoice(invoiceId);
        }}
        onEnsureLinkedInvoice={async () => {
          if (!controller.selectedBatch) {
            return;
          }
          setActiveTab('invoices');
          await invoiceController.ensureProcurementInvoice(
            controller.selectedBatch.id,
            controller.selectedTenantId,
          );
          void controller.refetchSelectedBatch();
        }}
      />

      <ReceivingBatchModal
        open={receivingBridge.receivingModal.isOpen}
        batch={receivingBridge.receivableBatch}
        warehouseOptions={receivingBridge.receivingModal.warehouseOptions}
        warehouseId={receivingBridge.receivingModal.warehouseId}
        stagingLocationId={receivingBridge.receivingModal.stagingLocationId}
        notes={receivingBridge.receivingModal.notes}
        lineQuantities={receivingBridge.receivingModal.lineQuantities}
        totalUnits={receivingBridge.receivingModal.totalUnits}
        isSubmitting={receivingBridge.receivingModal.isSubmitting}
        onClose={receivingBridge.receivingModal.close}
        onWarehouseChange={receivingBridge.receivingModal.setWarehouseId}
        onStagingLocationChange={receivingBridge.receivingModal.setStagingLocationId}
        onNotesChange={receivingBridge.receivingModal.setNotes}
        onLineQuantityChange={receivingBridge.receivingModal.setLineQuantity}
        onSubmit={receivingBridge.receivingModal.submit}
      />

      {receivingBridge.receivingModal.errorMessage ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {receivingBridge.receivingModal.errorMessage}
        </div>
      ) : null}

      <PurchasingInvoiceModal
        open={invoiceController.isInvoiceOpen}
        invoice={invoiceController.selectedInvoice}
        isLoading={invoiceController.isLoadingInvoice}
        canEdit={invoiceController.canEdit}
        isUpdatingStatus={invoiceController.isUpdatingStatus}
        isPrinting={isPrintingInvoice}
        onClose={invoiceController.closeInvoice}
        onEditDraft={invoiceController.openEditModal}
        onApplyStatus={(invoiceId, status) => invoiceController.updateInvoiceStatus(invoiceId, { status })}
        onPrint={handlePrintInvoice}
      />

      <PurchasingInvoiceEditorModal
        open={invoiceController.isEditorOpen}
        invoice={
          invoiceController.editingInvoiceId
            ? invoiceController.selectedInvoice?.id === invoiceController.editingInvoiceId
              ? invoiceController.selectedInvoice
              : null
            : null
        }
        tenantReady={invoiceController.overview?.tenantReady ?? false}
        isSaving={invoiceController.isSavingEditor}
        onClose={invoiceController.closeEditor}
        onCreate={invoiceController.createInvoice}
        onUpdate={invoiceController.updateInvoice}
      />
    </div>
  );
}

function InvoiceSummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e8ed] bg-[#fbfcfc] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-primary">{value}</p>
      <p className="mt-1 text-[12px] text-[#7b8e9c]">{hint}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(' ');
    }

    if (typeof payload?.message === 'string') {
      return payload.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to prepare the invoice document.';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PaginationFooter({
  start,
  end,
  total,
  page,
  totalPages,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}: {
  start: number;
  end: number;
  total: number;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  disablePrevious: boolean;
  disableNext: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        Showing {start}-{end} of {total}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={disablePrevious}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={disableNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
