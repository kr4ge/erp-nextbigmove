'use client';

import { ArrowLeft } from 'lucide-react';

interface StoreDetailBackButtonProps {
  onBack: () => void;
}

export function StoreDetailBackButton({ onBack }: StoreDetailBackButtonProps) {
  return (
    <button
      onClick={onBack}
      className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Stores
    </button>
  );
}

