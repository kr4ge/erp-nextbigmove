import { ArrowRight, Sparkles } from 'lucide-react';
import { WmsPageHeader } from './wms-page-header';
import { WmsSectionCard } from './wms-section-card';

type WmsModulePlaceholderProps = {
  title: string;
  description: string;
  milestones: string[];
  nextStep: string;
};

export function WmsModulePlaceholder({
  title,
  description,
  milestones,
  nextStep,
}: WmsModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <WmsPageHeader title={title} description={description} eyebrow="WMS Module" />
      <WmsSectionCard
        title="Build Queue"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        metadata="Shell ready"
      >
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This workspace is now part of the WMS shell. The next pass should wire backend modules,
              typed services, and scan-ready flows into this route.
            </p>
            <div className="grid gap-3">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-600">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{milestone}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Next Step</p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{nextStep}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-2 text-sm font-medium text-orange-700 shadow-sm">
              Continue phase build
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </WmsSectionCard>
    </div>
  );
}
