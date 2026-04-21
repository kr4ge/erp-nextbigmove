'use client';

interface IntegrationsSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function IntegrationsSearchInput({
  value,
  onChange,
  placeholder = 'Search integrations',
}: IntegrationsSearchInputProps) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m1.85-5.4a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z"
        />
      </svg>
    </div>
  );
}
