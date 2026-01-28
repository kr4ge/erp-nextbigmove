"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BulkMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (mapping: string) => Promise<void>;
}

export function BulkMappingModal({
  isOpen,
  onClose,
  selectedCount,
  onSubmit,
}: BulkMappingModalProps) {
  const [mapping, setMapping] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mapping.trim()) {
      setError("Mapping value is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit(mapping.trim());
      setMapping("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update mapping");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setMapping("");
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Mapping</DialogTitle>
          <DialogDescription>
            Set mapping value for {selectedCount} selected product{selectedCount !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="mapping" className="block text-sm font-medium text-[#0F172A] mb-2">
              Mapping Value
            </label>
            <input
              id="mapping"
              type="text"
              value={mapping}
              onChange={(e) => {
                setMapping(e.target.value);
                setError("");
              }}
              placeholder="Enter mapping value"
              className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-[#64748B]">
              This value will be applied to all selected products
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              loading={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Updating..." : "Update Mapping"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
