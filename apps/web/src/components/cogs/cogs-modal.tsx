"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmActionDialog } from "@/app/(dashboard)/settings/_components/confirm-action-dialog";
import { CogsEntryForm } from "./cogs-entry-form";
import apiClient from "@/lib/api-client";
import { Pencil, Trash2 } from "lucide-react";
import { parseIntegrationErrorMessage } from "@/app/(dashboard)/integrations/_utils/integration-error";

interface Product {
  id: string;
  productId?: string;
  name: string;
}

interface CogsEntry {
  id: string;
  cogs: string;
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
  const { addToast } = useToast();
  const [currentCogs, setCurrentCogs] = useState<CogsEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CogsEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<CogsEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCogsData = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      const currentRes = await apiClient.get(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/current`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setCurrentCogs(currentRes.data || null);
    } catch (error) {
      console.error("Failed to fetch COGS data:", error);
    }
  }, [product.id, storeId]);

  useEffect(() => {
    if (isOpen) {
      void fetchCogsData();
    }
  }, [isOpen, fetchCogsData]);

  const handleAddCogs = async (cogs: number) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        addToast("error", "Unauthorized");
        return;
      }

      await apiClient.post(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs`,
        { cogs },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      await fetchCogsData();
      setShowForm(false);
      setEditingEntry(null);
      addToast("success", "COGS created.");
    } catch (error) {
      console.error("Failed to add COGS entry:", error);
      addToast("error", parseIntegrationErrorMessage(error));
    }
  };

  const handleUpdateCogs = async (cogsId: string, cogs: number) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        addToast("error", "Unauthorized");
        return;
      }

      await apiClient.patch(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/${cogsId}`,
        { cogs },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      await fetchCogsData();
      setShowForm(false);
      setEditingEntry(null);
      addToast("success", "COGS updated.");
    } catch (error) {
      console.error("Failed to update COGS entry:", error);
      addToast("error", parseIntegrationErrorMessage(error));
    }
  };

  const handleDeleteCogs = async (cogsId: string) => {
    try {
      setIsDeleting(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        addToast("error", "Unauthorized");
        return;
      }

      await apiClient.delete(
        `/integrations/pos-stores/${storeId}/products/${product.id}/cogs/${cogsId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      await fetchCogsData();
      setShowForm(false);
      setEditingEntry(null);
      setEntryToDelete(null);
      addToast("success", "COGS deleted.");
    } catch (error) {
      console.error("Failed to delete COGS entry:", error);
      addToast("error", parseIntegrationErrorMessage(error));
    } finally {
      setIsDeleting(false);
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
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="mb-3 gap-1.5">
            <DialogTitle>Manage COGS - {product.name}</DialogTitle>
            <DialogDescription>
              Store: {storeId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {!showForm && !currentCogs && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full rounded-lg border-2 border-dashed border-[#CBD5E1] p-4 text-[#64748B] transition hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                Add COGS
              </button>
            )}

            {!showForm && currentCogs && (
              <div className="card border border-blue-200 bg-blue-50/30 dark:bg-background-secondary">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="card-label mb-2">Current COGS</p>
                    <span className="text-2xl font-bold text-foreground">
                      PHP {parseFloat(currentCogs.cogs).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(currentCogs)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:text-slate-300"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEntryToDelete(currentCogs)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-slate-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showForm && (
              <CogsEntryForm
                onSubmit={(cogs) => {
                  if (editingEntry) {
                    return handleUpdateCogs(editingEntry.id, cogs);
                  }

                  return handleAddCogs(cogs);
                }}
                onCancel={handleCancelForm}
                initialCogs={editingEntry ? parseFloat(editingEntry.cogs) : undefined}
                isEditing={!!editingEntry}
              />
            )}

            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(entryToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setEntryToDelete(null);
          }
        }}
        title="Delete COGS"
        description="Are you sure you want to delete this COGS entry? This action cannot be undone."
        confirmLabel="Delete COGS"
        cancelLabel="Cancel"
        isConfirming={isDeleting}
        onConfirm={() => {
          if (!entryToDelete) return;
          void handleDeleteCogs(entryToDelete.id);
        }}
      />
    </>
  );
}
