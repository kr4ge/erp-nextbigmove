"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CogsEntryForm } from "./cogs-entry-form";

interface BulkCogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (cogs: number) => Promise<void>;
}

export function BulkCogsModal({
  isOpen,
  onClose,
  selectedCount,
  onSubmit,
}: BulkCogsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const parseErrorMessage = (submissionError: unknown, fallback: string) => {
    if (!submissionError || typeof submissionError !== "object") return fallback;
    const maybeError = submissionError as { message?: unknown };
    if (typeof maybeError.message === "string" && maybeError.message.trim().length > 0) {
      return maybeError.message;
    }
    return fallback;
  };

  const handleSubmit = async (cogs: number) => {
    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit(cogs);
      onClose();
    } catch (submissionError) {
      setError(parseErrorMessage(submissionError, "Failed to update COGS"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update COGS</DialogTitle>
          <DialogDescription>
            Apply one COGS amount to {selectedCount} selected product{selectedCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4"></div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <CogsEntryForm
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isSubmitting={isSubmitting}
          title="Bulk Update COGS"
          amountLabel="COGS Amount"
          submitLabel="Apply COGS"
        />
      </DialogContent>
    </Dialog>
  );
}
