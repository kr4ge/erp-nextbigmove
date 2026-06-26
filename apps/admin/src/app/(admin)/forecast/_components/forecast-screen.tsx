'use client';

import { AlertCircle, CalendarDays, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import { useForecastController } from '../_hooks/use-forecast-controller';
import { ForecastCycleSelector } from './forecast-cycle-selector';
import { ForecastStoreMultiSelect } from './forecast-store-multi-select';
import { ForecastTable } from './forecast-table';

export function ForecastScreen() {
  const controller = useForecastController();

  return (
    <WmsPageShell
      title="Forecast"
      breadcrumb="WMS Forecast"
      description="Saved smart ordering snapshots from selected WMS stores."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void controller.refresh()}
            disabled={controller.isLoading || controller.isGenerating}
            className="btn btn-md btn-secondary btn-icon"
          >
            <RefreshCw className={`h-4 w-4 ${controller.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void controller.generateSnapshot()}
            disabled={controller.selectedStoreIds.length === 0 || controller.isGenerating}
            className="btn btn-md btn-primary btn-icon"
          >
            <RefreshCw className={`h-4 w-4 ${controller.isGenerating ? 'animate-spin' : ''}`} />
            {controller.data?.snapshot ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <WmsCompactPanel
          title="Forecast Filters"
          icon={<CalendarDays className="panel-icon" />}
        >
          <div>
            <div className="flex w-full min-w-0 items-center gap-2.5 overflow-x-auto pb-1">
              <ForecastCycleSelector
                cycles={controller.cycleSnapshots}
                selectedCycleDate={controller.cycleDate}
                onCycleChange={controller.setCycleDate}
              />

              <WmsSearchableSelect
                label="Partner"
                value={controller.selectedTenantId ?? ''}
                onChange={(value) => controller.changeTenant(value || undefined)}
                options={controller.tenantOptions.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.name,
                  selectedLabel: tenant.name,
                  hint: tenant.slug ?? undefined,
                }))}
                placeholder="Search partners..."
                allLabel="All partners"
                hideInlineLabel
              />

              <ForecastStoreMultiSelect
                stores={controller.storeOptions}
                selectedStoreIds={controller.selectedStoreIds}
                onToggleStore={controller.toggleStore}
                onClearStores={controller.clearStores}
              />

              <ForecastRuleInput label="Safety" suffix="%">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={controller.safetyStockPct}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.valueAsNumber;
                    controller.setSafetyStockPct(Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0);
                  }}
                  className="w-10 bg-transparent text-right text-sm-custom font-semibold tabular-nums text-foreground outline-none"
                />
              </ForecastRuleInput>

              <ForecastRuleInput label="Trigger" suffix="d">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={controller.reorderTriggerDays}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.valueAsNumber;
                    controller.setReorderTriggerDays(Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0);
                  }}
                  className="w-10 bg-transparent text-right text-sm-custom font-semibold tabular-nums text-foreground outline-none"
                />
              </ForecastRuleInput>
            </div>
          </div>
        </WmsCompactPanel>

        {controller.error ? (
          <div className="flex items-start gap-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{controller.error}</span>
          </div>
        ) : null}

        <ForecastTable data={controller.data} isLoading={controller.isLoading} />
      </div>
    </WmsPageShell>
  );
}

function ForecastRuleInput({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix: string;
  children: ReactNode;
}) {
  return (
    <label className="wms-pill-control flex shrink-0 items-center gap-2 rounded-2xl border border-[#d7e0e7] bg-white px-3 text-primary shadow-sm">
      <span className="card-label">{label}</span>
      {children}
      <span className="text-sm-custom font-semibold text-muted">{suffix}</span>
    </label>
  );
}
