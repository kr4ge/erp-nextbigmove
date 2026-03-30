import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default function SalesKpiPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Sales"
        description="Placeholder page. Sales KPI storage and tracking are not implemented yet."
      />
      <Card>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
          Sales KPI will be added later. The current KPI implementation is marketing-only.
        </div>
      </Card>
    </div>
  );
}
