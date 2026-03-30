import { formatReturnRate, getReturnRateColorClass, toNonNegativeNumber } from '../_utils/status';

type ReturnRateCellProps = {
  success: number | null | undefined;
  fail: number | null | undefined;
};

export function ReturnRateCell({ success, fail }: ReturnRateCellProps) {
  return (
    <span className="relative inline-flex cursor-help group">
      <span className={getReturnRateColorClass(success, fail)}>{formatReturnRate(success, fail)}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-md group-hover:block">
        Success: {toNonNegativeNumber(success)} | Fail: {toNonNegativeNumber(fail)}
      </span>
    </span>
  );
}
