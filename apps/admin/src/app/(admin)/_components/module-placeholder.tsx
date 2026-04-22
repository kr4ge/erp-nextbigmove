type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  milestones: string[];
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  milestones,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8798a4]">{eyebrow}</p>
          <h1 className="wms-page-title mt-3 font-semibold tracking-tight text-[#12384b]">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="wms-pill-control inline-flex items-center rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]">
            Build queue
          </span>
          <span className="wms-pill-control inline-flex items-center rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]">
            Scoped
          </span>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.78fr)]">
        <div className="wms-surface border border-[#dce4ea] bg-white shadow-[0_24px_60px_-42px_rgba(18,56,75,0.36)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8193a0]">Build</p>
              <h2 className="wms-section-title mt-3 font-semibold tracking-tight text-[#12384b]">Next steps</h2>
            </div>
            <span className="rounded-full bg-[#12384b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white">
              Upcoming
            </span>
          </div>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
            {milestones.map((milestone, index) => (
              <div
                key={milestone}
                className="wms-card border border-[#dce4ea] bg-[#fbfcfc]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8798a4]">
                  Step {index + 1}
                </p>
                <p className="mt-3 text-[14px] font-medium leading-6 text-[#12384b]">{milestone}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="wms-surface border border-[#dce4ea] bg-white shadow-[0_24px_60px_-42px_rgba(18,56,75,0.36)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8193a0]">{eyebrow}</p>
          <h2 className="wms-section-title mt-3 font-semibold tracking-tight text-[#12384b]">Focus</h2>
          <p className="mt-5 text-[14px] leading-7 text-[#5c7281]">{description}</p>
        </aside>
      </section>
    </div>
  );
}
