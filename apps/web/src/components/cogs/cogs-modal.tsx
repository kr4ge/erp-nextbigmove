"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CogsEntryForm } from "./cogs-entry-form";
import { CogsHistoryList } from "./cogs-history-list";
import { format } from "date-fns";
import apiClient from "@/lib/api-client";

interface Product {
  id: string;
  productId?: string;
  name: string;
}

interface CogsEntry {
  id: string;
  cogs: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CogsModalProps {
  product: Product;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CogsModal({ product, storeId, isOpen, onClose }: CogsModalProps) {
  const [cogsHistory, setCogsHistory] = useState<CogsEntry[]>([]);
  const [currentCogs, setCurrentCogs] = useState<CogsEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CogsEntry | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCogsData();
    }
  }, [isOpen, product.id, storeId]);

  const fetchCogsData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      const [historyRes, currentRes] = await Promise.all([
        apiClient.get(
          `/integrations/pos-stores/${storeId}/products/${product.id}/cogs`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        apiClient.get(
          `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/current`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);

      setCogsHistory(historyRes.data || []);
      setCurrentCogs(currentRes.data || null);
    } catch (error) {
      console.error("Failed to fetch COGS data:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasOverlap = (newStart: Date, newEnd: Date | null, excludeId?: string) => {
    const toDate = (d: string | null) => (d ? new Date(d) : new Date("9999-12-31"));
    const proposedEnd = newEnd || new Date("9999-12-31");
    const entries = [
      ...cogsHistory,
      ...(currentCogs ? [currentCogs] : []),
    ].filter((e) => !excludeId || e.id !== excludeId);

    return entries.some((entry) => {
      const existingStart = new Date(entry.startDate);
      const existingEnd = toDate(entry.endDate);
      return newStart <= existingEnd && existingStart <= proposedEnd;
    });
  };

  const handleAddCogs = async (cogs: number, startDate: Date, endDate?: Date | null) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Unauthorized");
        return;
      }

      // Validate dates
      if (!startDate || isNaN(startDate.getTime())) {
        alert("Invalid start date");
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        alert("Invalid end date");
        return;
      }

      if (endDate && endDate < startDate) {
        alert("End date cannot be before start date");
        return;
      }

      if (hasOverlap(startDate, endDate || null)) {
        alert("The selected date range overlaps with an existing COGS entry.");
        return;
      }

      await apiClient.post(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs`,
        {
          cogs,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchCogsData();
      setShowForm(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Failed to add COGS entry:", error);
      alert("Failed to add COGS entry");
    }
  };

  const handleUpdateCogs = async (cogsId: string, cogs: number, startDate: Date, endDate?: Date | null) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Unauthorized");
        return;
      }

      // Validate dates
      if (!startDate || isNaN(startDate.getTime())) {
        alert("Invalid start date");
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        alert("Invalid end date");
        return;
      }

      if (endDate && endDate < startDate) {
        alert("End date cannot be before start date");
        return;
      }

      if (hasOverlap(startDate, endDate || null, cogsId)) {
        alert("The selected date range overlaps with an existing COGS entry.");
        return;
      }

      await apiClient.patch(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/${cogsId}`,
        {
          cogs,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchCogsData();
      setShowForm(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Failed to update COGS entry:", error);
      alert("Failed to update COGS entry");
    }
  };

  const handleDeleteCogs = async (cogsId: string) => {
    if (!confirm("Are you sure you want to delete this COGS entry?")) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Unauthorized");
        return;
      }

      await apiClient.delete(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/${cogsId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchCogsData();
    } catch (error) {
      console.error("Failed to delete COGS entry:", error);
      alert("Failed to delete COGS entry");
    }
  };

  const handleEdit = (entry: CogsEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage COGS - {product.name}</DialogTitle>
          <DialogDescription>
            Store: {storeId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {currentCogs && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700 font-medium">Current COGS</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    ₱{parseFloat(currentCogs.cogs).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-emerald-700">
                    {format(new Date(currentCogs.startDate), "MMM d, yyyy")} → Present
                  </p>
                </div>
              </div>
            </div>
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full border-2 border-dashed border-[#CBD5E1] rounded-lg p-4 text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition"
            >
              ➕ Add New COGS Entry
            </button>
          )}

          {showForm && (
            <CogsEntryForm
              onSubmit={(cogs, startDate, endDate) => {
                if (editingEntry) {
                  handleUpdateCogs(
                    editingEntry.id,
                    cogs,
                    startDate,
                    endDate
                  );
                } else {
                  handleAddCogs(cogs, startDate, endDate);
                }
              }}
              onCancel={handleCancelForm}
              initialCogs={editingEntry ? parseFloat(editingEntry.cogs) : undefined}
              initialStartDate={editingEntry ? new Date(editingEntry.startDate) : undefined}
              initialEndDate={editingEntry && editingEntry.endDate ? new Date(editingEntry.endDate) : undefined}
              isEditing={!!editingEntry}
            />
          )}

          <div className="border-t border-[#E2E8F0] pt-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">
              📜 COGS History ({cogsHistory.length} {cogsHistory.length === 1 ? 'entry' : 'entries'})
            </h3>
            <CogsHistoryList
              entries={cogsHistory}
              onEdit={handleEdit}
              onDelete={handleDeleteCogs}
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
