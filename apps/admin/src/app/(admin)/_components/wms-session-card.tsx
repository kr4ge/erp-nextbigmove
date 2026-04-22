type WmsSessionCardProps = {
  name: string;
  email?: string;
  role?: string;
  tenantLabel: string;
};

export function WmsSessionCard({ name, email, role, tenantLabel }: WmsSessionCardProps) {
  return (
    <div className="mt-auto rounded-[28px] border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{name}</p>
      {email ? <p className="mt-1 text-xs text-slate-300">{email}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {role ? (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-100">
            {role}
          </span>
        ) : null}
        <span className="rounded-full border border-[#f8d45c]/30 bg-[#f8d45c]/15 px-3 py-1 text-[11px] font-medium tracking-wide text-[#f8d45c]">
          {tenantLabel}
        </span>
      </div>
    </div>
  );
}
