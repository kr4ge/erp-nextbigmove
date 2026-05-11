'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AnalyticsKpiOption = {
  key: string;
  label: string;
  section: 'Primary' | 'Secondary';
};

type AnalyticsKpiVisibilityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AnalyticsKpiOption[];
  selectedKeys: string[];
  onToggleKey: (key: string) => void;
  onSelectAll: () => void;
  onResetDefaults: () => void;
  title?: string;
  description?: string;
};

export function AnalyticsKpiVisibilityDialog({
  open,
  onOpenChange,
  options,
  selectedKeys,
  onToggleKey,
  onSelectAll,
  onResetDefaults,
  title = 'Visible KPI Boxes',
  description = 'Choose which KPI cards appear in Sales Monitoring.',
}: AnalyticsKpiVisibilityDialogProps) {
  const primaryOptions = options.filter((option) => option.section === 'Primary');
  const secondaryOptions = options.filter((option) => option.section === 'Secondary');

  const renderSection = (
    title: string,
    sectionOptions: AnalyticsKpiOption[],
  ) => (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sectionOptions.map((option) => (
          <label
            key={option.key}
            className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 transition hover:border-slate-300"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-primary checked:border-primary checked:bg-primary focus:ring-2 focus:ring-orange-200"
              checked={selectedKeys.includes(option.key)}
              onChange={() => onToggleKey(option.key)}
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl rounded-2xl border-slate-200 p-0"
        closeButtonClassName="!right-2 !top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 opacity-100 shadow-sm hover:border-orange-200 hover:text-orange-600 focus:ring-orange-200 data-[state=open]:bg-white [&>svg]:h-5 [&>svg]:w-5"
      >
        <div className="border-b border-slate-200 px-4 py-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <p className="text-sm text-slate-500">{description}</p>
          </DialogHeader>
        </div>

        <div className="max-h-[68vh] space-y-5 overflow-y-auto px-4 py-3">
          {renderSection('Sales KPIs', primaryOptions)}
          {renderSection('Marketing KPIs', secondaryOptions)}
        </div>

        <DialogFooter className="!flex-row !items-center !justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:space-x-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onResetDefaults}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
