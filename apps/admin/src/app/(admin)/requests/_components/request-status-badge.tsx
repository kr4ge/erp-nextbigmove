"use client";

import { cn } from "@/lib/utils";
import type {
  WmsInvoiceStatus,
  WmsPaymentStatus,
  WmsRequestStatus,
} from "../_types/requests";

type StatusTone = {
  label: string;
  className: string;
};

const REQUEST_TONES: Record<WmsRequestStatus, StatusTone> = {
  DRAFT: {
    label: "Draft",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  WMS_REVIEWED: {
    label: "Reviewed",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  PARTNER_CONFIRMED: {
    label: "Confirmed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  PARTNER_REJECTED: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  UNDER_AUDIT: {
    label: "Under Audit",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  FEEDBACK_REQUIRED: {
    label: "Feedback",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  AUDIT_ACCEPTED: {
    label: "Audit Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  INVOICED: {
    label: "Invoiced",
    className: "border-purple-200 bg-purple-50 text-purple-700",
  },
  PAYMENT_SUBMITTED: {
    label: "Payment Submitted",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  PAYMENT_VERIFIED: {
    label: "Payment Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  IN_PROCUREMENT: {
    label: "In Procurement",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  PARTIALLY_RECEIVED: {
    label: "Partial",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  RECEIVED: {
    label: "Received",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELED: {
    label: "Canceled",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const INVOICE_TONES: Record<WmsInvoiceStatus, StatusTone> = {
  UNPAID: {
    label: "Unpaid",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  PAYMENT_SUBMITTED: {
    label: "Payment Submitted",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  PAID: {
    label: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELED: {
    label: "Canceled",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

const PAYMENT_TONES: Record<WmsPaymentStatus, StatusTone> = {
  SUBMITTED: {
    label: "Submitted",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  VERIFIED: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  REJECTED: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

type RequestStatusBadgeProps = {
  status: WmsRequestStatus | WmsInvoiceStatus | WmsPaymentStatus;
  kind?: "request" | "invoice" | "payment";
};

export function RequestStatusBadge({
  status,
  kind = "request",
}: RequestStatusBadgeProps) {
  const tone =
    kind === "invoice"
      ? INVOICE_TONES[status as WmsInvoiceStatus]
      : kind === "payment"
        ? PAYMENT_TONES[status as WmsPaymentStatus]
        : REQUEST_TONES[status as WmsRequestStatus];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}
