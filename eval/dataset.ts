import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { Dispute, DisputeReason, Tracker } from "@/lib/paypal/types";
import type { BuyerHistory } from "@/lib/source";

// Synthetic disputes with the action a careful seller should take, labelled before any run.
// Where two actions are defensible, both count as correct. Invented names and numbers.

export type Lean = "FIGHT" | "ACCEPT" | "OFFER";
export type EvalCase = {
  id: string;
  title: string;
  expected: Lean[];
  why: string;
  dispute: Dispute;
  trackers: Tracker[];
  record: FulfillmentRecord;
  history?: Partial<BuyerHistory>;
};

const day = 86_400_000;
const NOW = Date.parse("2026-10-20T15:00:00Z");
const at = (d: number) => new Date(NOW + d * day).toISOString();

type Spec = {
  title: string;
  expected: Lean[];
  why: string;
  reason: DisputeReason;
  amount: number;
  item: string;
  buyer: string;
  message?: string;
  stage?: "INQUIRY" | "CHARGEBACK";
  record?: Partial<FulfillmentRecord>;
  tracker?: { carrier: string; number: string; status: string };
  history?: Partial<BuyerHistory>;
};

function mk(n: number, s: Spec): EvalCase {
  const captureId = `EVAL-CAP-${n}`;
  const value = s.amount.toFixed(2);
  const email = `${s.buyer.toLowerCase().replace(/\W+/g, ".")}@example.com`;
  return {
    id: `EVAL-${String(n).padStart(2, "0")}`,
    title: s.title,
    expected: s.expected,
    why: s.why,
    dispute: {
      dispute_id: `PP-D-EVAL-${n}`,
      create_time: at(-1),
      update_time: at(-1),
      reason: s.reason,
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value },
      dispute_life_cycle_stage: s.stage ?? "INQUIRY",
      dispute_channel: "INTERNAL",
      seller_response_due_date: at(9),
      disputed_transactions: [
        {
          seller_transaction_id: captureId,
          create_time: at(-14),
          gross_amount: { currency_code: "USD", value },
          buyer: { name: s.buyer },
          items: [{ item_name: s.item, item_quantity: "1" }],
        },
      ],
      messages: s.message ? [{ posted_by: "BUYER", time_posted: at(-1), content: s.message }] : [],
    },
    trackers: s.tracker
      ? [{ transaction_id: captureId, tracking_number: s.tracker.number, carrier: s.tracker.carrier, status: s.tracker.status, shipment_date: at(-13).slice(0, 10) }]
      : [],
    record: {
      orderId: `EVAL-ORDER-${n}`,
      captureId,
      createdAt: at(-14),
      buyerName: s.buyer,
      buyerEmail: email,
      shipTo: "Portland, OR, US",
      items: [{ name: s.item, quantity: 1, unitPrice: value }],
      total: value,
      ...(s.tracker ? { carrier: s.tracker.carrier, trackingNumber: s.tracker.number, shippedAt: at(-13) } : {}),
      ...s.record,
    },
    history: s.history,
  };
}

const delivered = (number: string, carrier = "USPS") => ({ carrier, number, status: "DELIVERED" });

export const cases: EvalCase[] = [
  mk(1, {
    title: "Not received, carrier delivered and signed",
    expected: ["FIGHT"],
    why: "Carrier DELIVERED scan plus a signature on file is the strongest not-received defence.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 189,
    item: "Merino wool throw, oat",
    buyer: "Jordan Avery",
    message: "It never arrived.",
    tracker: delivered("9400111202061234567801"),
    record: { deliveredAt: at(-9), signedBy: "J AVERY", notes: ["Shipped with signature confirmation."] },
  }),
  mk(2, {
    title: "Not received, carrier delivered, under signature threshold",
    expected: ["FIGHT"],
    why: "Below $150 no signature is required; a carrier DELIVERED scan to the payment address wins.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 120,
    item: "Ceramic table lamp, sage",
    buyer: "Kim Park",
    message: "Where is my lamp?",
    tracker: delivered("1Z999AA10123456802", "UPS"),
    record: { deliveredAt: at(-8) },
  }),
  mk(3, {
    title: "Not received, delivered with porch photo",
    expected: ["FIGHT"],
    why: "Carrier delivery plus a delivery photo; nothing contradicts it.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 130,
    item: "Soy candle trio",
    buyer: "Lee Tran",
    message: "Not received.",
    tracker: delivered("9400111202061234567803"),
    record: { deliveredAt: at(-7), deliveryPhoto: true, notes: ["Carrier photo shows the box at the front door."] },
  }),
  mk(4, {
    title: "Not received, shipped without tracking",
    expected: ["ACCEPT", "OFFER"],
    why: "No tracking means no proof of delivery; the seller should make it right.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 45,
    item: "Beeswax tealights, 12 pack",
    buyer: "Sam Ortiz",
    message: "Three weeks, nothing.",
    record: { carrier: "USPS", shippedAt: at(-13), notes: ["Sent as a letter without tracking."] },
  }),
  mk(5, {
    title: "Not received, shop says delivered, tracker says returned",
    expected: ["ACCEPT", "OFFER"],
    why: "The carrier contradicts the shop record; the parcel went back to the sender.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 210,
    item: "Stoneware set, 4 pieces",
    buyer: "Rosa Diaz",
    message: "Still nothing after two weeks.",
    tracker: { carrier: "UPS", number: "1Z999AA10123456805", status: "RETURNED" },
    record: { deliveredAt: at(-9), signedBy: "R DIAZ", notes: ["Shipped with signature required."] },
  }),
  mk(6, {
    title: "Not received, tracker stuck in transit",
    expected: ["ACCEPT", "OFFER"],
    why: "No delivery scan after weeks; the seller cannot prove delivery.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 160,
    item: "Linen throw, rust",
    buyer: "Ana Silva",
    message: "Tracking hasn't moved in 12 days.",
    tracker: { carrier: "USPS", number: "9400111202061234567806", status: "SHIPPED" },
  }),
  mk(7, {
    title: "Not received, $240 delivered without signature",
    expected: ["FIGHT", "OFFER"],
    why: "Carrier says delivered but policy required a signature over $150; fighting or a goodwill offer are both reasonable.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 240,
    item: "Merino wool throw, charcoal",
    buyer: "Chris Wolfe",
    message: "Never got it.",
    tracker: delivered("9400111202061234567807"),
    record: { deliveredAt: at(-6) },
  }),
  mk(8, {
    title: "Not as described, lamp arrived cracked",
    expected: ["OFFER", "ACCEPT"],
    why: "Damage in transit with a buyer photo; policy says replace or refund.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    amount: 95,
    item: "Ceramic table lamp, sage",
    buyer: "Priya Nair",
    message: "The base is cracked straight through, photo attached.",
    tracker: delivered("1Z999AA10123456808", "UPS"),
    record: { deliveredAt: at(-6), notes: ["Packed in a single box, no inner padding."] },
  }),
  mk(9, {
    title: "Not as described, colour slightly off",
    expected: ["OFFER", "FIGHT"],
    why: "Minor mismatch the listing warns about; a small partial refund or a defence both fit.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    amount: 60,
    item: "Linen cushion cover, pair",
    buyer: "Noor Haddad",
    message: "The green is a bit darker than the photo.",
    tracker: delivered("9400111202061234567809"),
    record: { deliveredAt: at(-5), notes: ["Listing says colours vary slightly by screen and dye batch."] },
  }),
  mk(10, {
    title: "Not as described, wrong size claimed but packing record matches",
    expected: ["FIGHT", "OFFER"],
    why: "The packing record shows the size the buyer ordered.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    amount: 150,
    item: "Wool blanket, king",
    buyer: "Tom Becker",
    message: "This is a queen, not a king.",
    tracker: delivered("1Z999AA10123456810", "UPS"),
    record: { deliveredAt: at(-6), signedBy: "T BECKER", notes: ["Packed by Mia: king size, label checked and photographed before boxing."] },
  }),
  mk(11, {
    title: "Not as described, cheap candle broken in transit",
    expected: ["ACCEPT", "OFFER"],
    why: "Low value, damaged in transit, buyer has photos; refund or replace.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    amount: 28,
    item: "Glass jar candle",
    buyer: "Eve Larsen",
    message: "The jar shattered in the box. Photos attached.",
    tracker: delivered("9400111202061234567811"),
    record: { deliveredAt: at(-4) },
  }),
  mk(12, {
    title: "Unauthorised, returning buyer, delivered and signed at account address",
    expected: ["FIGHT"],
    why: "Delivery to the account address, a signature, prior orders and a thank-you email.",
    reason: "UNAUTHORISED",
    amount: 240,
    item: "Merino wool throw and candles",
    buyer: "Morgan Lee",
    stage: "CHARGEBACK",
    tracker: delivered("1Z999AA10123456812", "UPS"),
    record: {
      deliveredAt: at(-10),
      signedBy: "M LEE",
      notes: ["Shipped to the address on the buyer's PayPal account.", "Buyer emailed on delivery day to say thanks."],
    },
    history: { orders: 3, totalSpent: 161, firstOrderAt: at(-200) },
  }),
  mk(13, {
    title: "Unauthorised, first order to a forwarding address, no signature",
    expected: ["ACCEPT"],
    why: "Classic stolen-card pattern; little to defend with.",
    reason: "UNAUTHORISED",
    amount: 180,
    item: "Stoneware set, 4 pieces",
    buyer: "Dana Hill",
    stage: "CHARGEBACK",
    tracker: delivered("9400111202061234567813"),
    record: { deliveredAt: at(-8), shipTo: "Freight forwarder, Miami, FL, US", notes: ["Ship-to differs from the PayPal account address."] },
  }),
  mk(14, {
    title: "Credit not processed, refund already issued",
    expected: ["FIGHT"],
    why: "A refund ID is decisive proof.",
    reason: "CREDIT_NOT_PROCESSED",
    amount: 60,
    item: "Linen cushion cover, pair",
    buyer: "Alex Romero",
    message: "I returned the covers and still have no refund.",
    tracker: delivered("9400111202061234567814"),
    record: { deliveredAt: at(-20), refunds: [{ refundId: "EVAL-REFUND-14", amount: "60.00", at: at(-3) }], notes: ["Return received; refund issued next day."] },
  }),
  mk(15, {
    title: "Credit not processed, return received but refund forgotten",
    expected: ["ACCEPT", "OFFER"],
    why: "The shop has the item back and owes the refund.",
    reason: "CREDIT_NOT_PROCESSED",
    amount: 85,
    item: "Wool scarf",
    buyer: "Ben Clark",
    message: "You got my return a week ago. Where is my money?",
    tracker: delivered("9400111202061234567815"),
    record: { deliveredAt: at(-25), notes: ["Return received 8 days ago, unused, back in stock. No refund issued yet."] },
  }),
  mk(16, {
    title: "Credit not processed, return never arrived",
    expected: ["FIGHT", "OFFER"],
    why: "Policy refunds on receipt; no return is on file and the buyer gave no return tracking.",
    reason: "CREDIT_NOT_PROCESSED",
    amount: 70,
    item: "Ceramic mug set",
    buyer: "Ivy Chen",
    message: "I sent it back, refund me.",
    tracker: delivered("9400111202061234567816"),
    record: { deliveredAt: at(-30), notes: ["No return received. Buyer did not send return tracking when asked."] },
  }),
  mk(17, {
    title: "Duplicate charge that really happened",
    expected: ["ACCEPT"],
    why: "Two captures for one order; refund the extra one.",
    reason: "DUPLICATE_TRANSACTION",
    amount: 48,
    item: "Candle making kit",
    buyer: "Max Young",
    message: "Charged twice.",
    record: { notes: ["Checkout retried after a timeout; two $48.00 payments were captured for one order."] },
  }),
  mk(18, {
    title: "Duplicate claim with a single capture",
    expected: ["FIGHT"],
    why: "Only one payment exists; the second line was a separate order the buyer placed.",
    reason: "DUPLICATE_TRANSACTION",
    amount: 120,
    item: "Wool throw, oat",
    buyer: "Zoe King",
    message: "I see two charges.",
    tracker: delivered("9400111202061234567818"),
    record: { deliveredAt: at(-9), notes: ["One capture for this order. Buyer placed a second, separate order two days later, also shipped."] },
  }),
  // Quick calls: the money math decides these in code, so no AI runs.
  mk(19, {
    title: "Duplicate $6 charge (quick call)",
    expected: ["ACCEPT"],
    why: "Fighting cannot pay off at this amount.",
    reason: "DUPLICATE_TRANSACTION",
    amount: 6,
    item: "Cotton wick refill",
    buyer: "Casey Brooks",
  }),
  mk(20, {
    title: "Not received $5, delivered (quick call)",
    expected: ["ACCEPT"],
    why: "Even a sure win loses money once the fee risk and time are counted.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    amount: 5,
    item: "Matchbook",
    buyer: "Rae Cole",
    tracker: delivered("9400111202061234567820"),
  }),
  mk(21, {
    title: "Not as described $4 (quick call)",
    expected: ["ACCEPT"],
    why: "Below break-even for any win chance.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    amount: 4,
    item: "Gift tag set",
    buyer: "Ola Berg",
  }),
];
