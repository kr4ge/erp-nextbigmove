import type { LucideIcon } from 'lucide-react';

type WmsReadinessCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'teal' | 'yellow' | 'lavender';
};

const toneClassMap: Record<NonNullable<WmsReadinessCardProps['tone']>, string> = {
  teal: 'bg-[#12384b] text-white',
  yellow: 'bg-[#f7cf5f] text-[#12384b]',
  lavender: 'bg-[#ddd6f5] text-[#3c3562]',
};

export function WmsReadinessCard({
  icon: Icon,
  label,
  value,
  tone = 'teal',
}: WmsReadinessCardProps) {
  return (
    <div className="wms-card border border-[#dce4ea] bg-[#fcfcfb] shadow-[0_20px_45px_-36px_rgba(18,56,75,0.35)]">
      <div className="flex items-start justify-between">
        <div className={`rounded-full p-2.5 ${toneClassMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[2.1rem] font-semibold tracking-tight text-[#12384b]">{value.toLocaleString()}</span>
      </div>
      <p className="mt-4 text-[13px] font-semibold text-[#12384b]">{label}</p>
    </div>
  );
}
