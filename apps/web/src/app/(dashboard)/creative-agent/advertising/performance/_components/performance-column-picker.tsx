'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PERFORMANCE_COLUMNS, type PerfColumnGroup } from '../_constants/performance-columns';

const GROUP_ORDER: PerfColumnGroup[] = ['Identity', 'Today', 'Engagement', 'Orders', 'Money'];

export function PerformanceColumnPicker({ open, onOpenChange, visibleKeys, onToggle, onReset }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="mb-0">Customize columns</DialogTitle>
        <DialogDescription>
          Locked identity columns always stay visible. Your choices are remembered on this device.
        </DialogDescription>
        <div className="mt-4 grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
          {GROUP_ORDER.map((group) => {
            const columns = PERFORMANCE_COLUMNS.filter((column) => column.group === group && column.label);
            if (columns.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">{group}</p>
                <div className="mt-2 grid gap-1.5">
                  {columns.map((column) => (
                    <label key={column.key} className={`flex items-center gap-2 text-sm-custom ${column.locked ? 'opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-[rgb(var(--primary))]"
                        checked={column.locked || visibleKeys.includes(column.key)}
                        disabled={column.locked}
                        onChange={() => onToggle(column.key)}
                      />
                      <span className="text-foreground">{column.label}</span>
                      {column.locked ? <span className="text-xs-tight text-faint">locked</span> : null}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
          <Button variant="ghost" size="sm" onClick={onReset}>Reset to defaults</Button>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
