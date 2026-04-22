'use client';

import { Edit3, PackagePlus } from 'lucide-react';
import type { WmsLocationTreeNode } from '../_types/warehouse';

function countDescendants(node: WmsLocationTreeNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

type LocationNodeProps = {
  node: WmsLocationTreeNode;
  depth?: number;
  onEdit: (location: WmsLocationTreeNode) => void;
};

export function LocationNode({ node, depth = 0, onEdit }: LocationNodeProps) {
  if (depth >= 2) {
    return (
      <button
        type="button"
        onClick={() => onEdit(node)}
        className={`wms-chip rounded-full border transition ${
          node.isActive
            ? 'border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677] hover:border-[#c7d5de] hover:bg-white'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}
      >
        {node.code}
      </button>
    );
  }

  const childCount = countDescendants(node);

  return (
    <div
      className={`rounded-[24px] border border-[#dce4ea] bg-[#fcfcfb] p-4 ${
        depth === 0 ? 'shadow-[0_20px_45px_-38px_rgba(18,56,75,0.34)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#12384b]">{node.name}</span>
            <span className="rounded-full border border-[#e0e7ec] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7d909d]">
              {node.code}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[#6a7f8d]">
            {node.kind.toLowerCase().replaceAll('_', ' ')}
            {childCount > 0 ? ` · ${childCount} child` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEdit(node)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#5e7887] transition hover:border-[#c6d4dd] hover:text-[#12384b]"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {node.children.length > 0 ? (
        <div className={`mt-4 ${depth === 0 ? 'space-y-3' : 'flex flex-wrap gap-2.5'}`}>
          {node.children.map((child) => (
            <LocationNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} />
          ))}
        </div>
      ) : depth < 2 ? (
        <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-dashed border-[#dce4ea] bg-[#fbfcfc] px-3 py-2 text-[12px] text-[#7a8d99]">
          <PackagePlus className="h-3.5 w-3.5" />
          No child locations
        </div>
      ) : null}
    </div>
  );
}
