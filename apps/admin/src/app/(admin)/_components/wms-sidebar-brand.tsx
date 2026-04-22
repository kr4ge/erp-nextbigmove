export function WmsSidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
      <div className="relative h-8 w-8 overflow-hidden rounded-xl bg-[#f7cf5f]">
        <div className="absolute inset-y-0 right-0 w-6 rounded-l-full bg-[#12384b]" />
        <div className="absolute inset-y-0 left-0 w-4 bg-[#f7cf5f]" />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-[1.12rem] font-semibold leading-tight tracking-tight text-white">Next Big Move</p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-white/55">Warehouse</p>
        </div>
      ) : null}
    </div>
  );
}
