// The demo merchant. A fictional shop so nothing in the demo belongs to a real business.
export const merchant = {
  name: "Lumen & Loom",
  tagline: "Handmade candles, lamps and wool throws",
  currency: "USD",
  disputeFee: 15, // what the seller pays when a dispute is lost; check your own PayPal fee schedule
  hourlyRate: 40, // what an hour of the owner's time is worth
  minutesWithDraft: 6, // time to review and send a drafted response
  minutesWithoutDraft: 45, // typical time to assemble evidence by hand
  signatureThreshold: 150, // shop policy: orders at or above this ship with signature confirmation
  typicalSuccessFee: 0.25, // what a percentage-of-wins dispute service typically keeps, for comparison
  policy: [
    "Orders ship within 2 business days with tracking.",
    "Orders over $150 ship with signature confirmation.",
    "Returns accepted within 30 days of delivery for unused items; buyer pays return shipping unless the item arrived damaged.",
    "Items damaged in transit are replaced or refunded on receipt of a photo.",
    "Refunds are issued to the original PayPal payment within 3 business days of approval.",
  ],
};

export type Merchant = typeof merchant;
