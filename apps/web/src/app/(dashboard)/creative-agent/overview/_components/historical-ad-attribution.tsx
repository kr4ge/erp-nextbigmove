import { History } from 'lucide-react';
import type { HistoricalCreativeAd } from '../_types/creative-overview';
import { formatCount, formatCurrency, formatPercent } from '../_utils/creative-overview-format';
import { PanelHeader } from './overview-ui';

export function HistoricalAdAttribution({
  data,
  showCreator,
}: {
  data?: { total: number; items: HistoricalCreativeAd[] };
  showCreator: boolean;
}) {
  if (!data?.total) return null;

  return (
    <section className="panel panel-content shadow-card">
      <PanelHeader
        title="Historical Meta ads"
        description="Pre-registry ads matched by employee ID. They are included in performance totals but remain separate from enrolled assets."
        right={(
          <span className="pill pill-info gap-1.5">
            <History className="h-3.5 w-3.5" />
            {formatCount(data.total)} matched
          </span>
        )}
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-border/40 bg-secondary/20">
            <tr className="text-xs-tight font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Meta ad</th>
              {showCreator ? <th className="px-5 py-3">Creator</th> : null}
              <th className="px-5 py-3 text-right">Spend</th>
              <th className="px-5 py-3 text-right">Orders</th>
              <th className="px-5 py-3 text-right">CTR</th>
              <th className="px-5 py-3 text-right">MAR%</th>
              <th className="px-5 py-3">Attribution</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {data.items.map((item) => (
              <tr key={item.adId} className="border-b border-border/30 last:border-b-0 hover:bg-background-secondary/50">
                <td className="max-w-sm px-5 py-3.5">
                  <p className="truncate text-sm-custom font-semibold text-foreground" title={item.adName}>{item.adName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted" title={item.campaignName ?? item.adId}>{item.campaignName ?? item.adId}</p>
                </td>
                {showCreator ? (
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">
                    <p className="font-medium">{item.creator.name}</p>
                    <p className="text-xs text-muted">Employee {item.creator.employeeId}</p>
                  </td>
                ) : null}
                <td className="px-5 py-3.5 text-right text-sm-custom font-semibold tabular-nums text-foreground">{formatCurrency(item.metrics.spend)}</td>
                <td className="px-5 py-3.5 text-right text-sm-custom tabular-nums text-foreground">{formatCount(item.metrics.orders)}</td>
                <td className="px-5 py-3.5 text-right text-sm-custom tabular-nums text-foreground">{formatPercent(item.metrics.ctr)}</td>
                <td className="px-5 py-3.5 text-right text-sm-custom tabular-nums text-foreground">{formatPercent(item.metrics.mar)}</td>
                <td className="px-5 py-3.5"><span className="pill pill-ghost whitespace-nowrap">Employee ID</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.items.length ? (
        <p className="border-t border-border/40 px-5 py-3 text-xs text-muted">
          Showing the top {data.items.length} historical ads by spend for this period.
        </p>
      ) : null}
    </section>
  );
}
