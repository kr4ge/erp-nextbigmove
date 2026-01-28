"use client";

import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

interface CogsEntry {
  id: string;
  cogs: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CogsHistoryListProps {
  entries: CogsEntry[];
  onEdit: (entry: CogsEntry) => void;
  onDelete: (cogsId: string) => void;
}

export function CogsHistoryList({ entries, onEdit, onDelete }: CogsHistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-[#94A3B8]">
        <p>No COGS history yet</p>
        <p className="text-sm mt-1">Add your first COGS entry above</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isActive = entry.endDate === null;
        const startDate = format(new Date(entry.startDate), "MMM d, yyyy");
        const endDate = entry.endDate
          ? format(new Date(entry.endDate), "MMM d, yyyy")
          : "Present";

        return (
          <div
            key={entry.id}
            className={`border rounded-lg p-4 hover:bg-[#F8FAFC] transition ${
              isActive ? "border-blue-200 bg-blue-50/30" : "border-[#E2E8F0] bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-[#0F172A]">
                    ₱{parseFloat(entry.cogs).toFixed(2)}
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                      Current • Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#64748B] mt-1">
                  {startDate} → {endDate}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(entry)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2563EB] transition focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#64748B] hover:bg-red-50 hover:text-red-600 transition focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
