import "server-only";
import { readJson, updateJson } from "@/lib/store";

// The merchant's own shop records: what was sold, shipped and refunded.
// PayPal knows the payment; the shop knows the delivery details a dispute turns on.
export type FulfillmentRecord = {
  orderId: string;
  captureId: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  shipTo: string;
  items: { name: string; quantity: number; unitPrice: string }[];
  total: string;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  signedBy?: string;
  deliveryPhoto?: boolean;
  refunds?: { refundId: string; amount: string; at: string }[];
  notes?: string[];
};

const FILE = "fulfillment";

export const listFulfillment = () => readJson<FulfillmentRecord[]>(FILE, []);

export async function findFulfillment(by: { captureId?: string; orderId?: string }) {
  const all = await listFulfillment();
  return all.find((r) => (by.captureId && r.captureId === by.captureId) || (by.orderId && r.orderId === by.orderId)) ?? null;
}

export function upsertFulfillment(record: FulfillmentRecord) {
  return updateJson<FulfillmentRecord[]>(FILE, [], (all) => [
    ...all.filter((r) => r.orderId !== record.orderId),
    record,
  ]);
}

export function patchFulfillment(orderId: string, patch: Partial<FulfillmentRecord>) {
  return updateJson<FulfillmentRecord[]>(FILE, [], (all) =>
    all.map((r) => (r.orderId === orderId ? { ...r, ...patch } : r)),
  );
}
