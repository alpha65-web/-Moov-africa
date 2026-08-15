import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, type OfferStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        OFFER_STATUS_COLORS[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {OFFER_STATUS_LABELS[status] || status}
    </span>
  );
}
