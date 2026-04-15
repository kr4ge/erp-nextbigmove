import type {
  WmsFulfillmentOperator,
  WmsFulfillmentOrderStatus,
} from "../_types/fulfillment";

export function formatFulfillmentStatusLabel(
  status: WmsFulfillmentOrderStatus,
) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
}

export function formatShortDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatOrderDate(value: string | null | undefined) {
  if (!value) {
    return "No local date";
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return value;
}

export function formatOperatorLabel(
  operator:
    | WmsFulfillmentOperator
    | {
        id: string;
        name: string | null;
        email: string;
      }
    | null
    | undefined,
) {
  if (!operator) {
    return "Unassigned";
  }

  return operator.name || operator.email;
}
