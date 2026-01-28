import { useState, useMemo } from 'react';
import { Card } from './card';
import { StatusBadge } from './status-badge';
import { Eye, EyeOff, Copy } from 'lucide-react';

type ApiKeyCardProps = {
  label?: string;
  apiKey?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'DISABLED' | 'ERROR' | 'INFO';
  action?: React.ReactNode;
};

export function ApiKeyCard({ label = 'API Key', apiKey, status = 'ACTIVE', action }: ApiKeyCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayValue = useMemo(() => {
    if (showKey) return apiKey || '';
    const len = apiKey?.length || 8;
    return '•'.repeat(len);
  }, [apiKey, showKey]);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            {status && <StatusBadge status={status as any} />}
            <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
          </div>
          {action && <div>{action}</div>}
        </div>
        <div className="relative">
          <input
            readOnly
            value={displayValue}
            onClick={handleCopy}
            className="w-full cursor-pointer rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 pr-12 font-mono text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-2">
            {apiKey && (
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="rounded-md p-1 text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
            {apiKey && (
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md p-1 text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
                aria-label="Copy API key"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          {copied ? <span className="text-emerald-600">Copied</span> : <span>Click to copy</span>}
        </div>
      </div>
    </Card>
  );
}
