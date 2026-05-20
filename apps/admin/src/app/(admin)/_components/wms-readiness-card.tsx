import type { LucideIcon } from 'lucide-react';

type WmsReadinessCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'teal' | 'yellow' | 'lavender';
};

const toneClassMap: Record<NonNullable<WmsReadinessCardProps['tone']>, string> = {
  teal: 'bg-primary text-white',
  yellow: 'bg-[#f7cf5f] text-primary',
  lavender: 'bg-[#ddd6f5] text-primary',
};

export function WmsReadinessCard({
  icon: Icon,
  label,
  value,
  tone = 'teal',
}: WmsReadinessCardProps) {
  return (
    <div className="card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="card-label"
          >
            {label}
          </p>
          <p className="card-value"
          >
            {value}
          </p>
        </div>
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${toneClassMap[tone]}`}
        >
          <Icon className='h-4 w-4'/>
        </div>
      </div>
    </div>
  );
}
