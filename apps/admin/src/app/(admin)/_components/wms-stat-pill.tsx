type WmsStatPillTone = 'default' | 'accent' | 'success' | 'muted';

type WmsStatPillProps = {
  label: string;
  value: string;
  tone?: WmsStatPillTone;
};

const TONE_CLASS_NAMES: Record<WmsStatPillTone, string> = {
  default: 'border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]',
  accent: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  muted: 'border-[#e7edf2] bg-white text-[#6f8290]',
};

export function WmsStatPill({
  label,
  value,
  tone = 'default',
}: WmsStatPillProps) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${TONE_CLASS_NAMES[tone]}`}>
      <span className="tabular-nums text-[#12384b]">{value}</span>
      <span>{label}</span>
    </span>
  );
}
