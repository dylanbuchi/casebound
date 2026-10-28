import type { Dispute, Tracker } from "@/lib/paypal/types";
import type { FulfillmentRecord } from "@/lib/fulfillment";

// Demo data in the exact shape the PayPal sandbox returns, so demo and live share one code path.
// Names and addresses are invented.

const day = 86_400_000;
// Vary the time of day per date so records do not share identical timestamps.
const at = (daysFromNow: number) =>
  new Date(Date.now() + (daysFromNow + (((daysFromNow * 7919) % 13) - 6) / 30) * day).toISOString();

type Fixture = { dispute: Dispute; trackers: Tracker[]; fulfillment: FulfillmentRecord };

function fixture(
  n: number,
  d: Omit<Dispute, "dispute_id" | "update_time" | "dispute_channel" | "links">,
  f: Omit<FulfillmentRecord, "orderId" | "captureId">,
  trackers: Omit<Tracker, "transaction_id">[] = [],
): Fixture {
  const captureId = `DEMO-CAP-${n}`;
  return {
    dispute: {
      ...d,
      dispute_id: `PP-D-DEMO-${n}`,
      update_time: d.create_time,
      dispute_channel: "INTERNAL",
      disputed_transactions: (d.disputed_transactions ?? []).map((t) => ({ ...t, seller_transaction_id: captureId })),
    },
    trackers: trackers.map((t) => ({ ...t, transaction_id: captureId })),
    fulfillment: { ...f, orderId: `DEMO-ORDER-${n}`, captureId },
  };
}

export const demoFixtures: Fixture[] = [
  fixture(
    1,
    {
      create_time: at(-1),
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "189.00" },
      dispute_life_cycle_stage: "INQUIRY",
      seller_response_due_date: at(9),
      disputed_transactions: [
        {
          create_time: at(-12),
          gross_amount: { currency_code: "USD", value: "189.00" },
          buyer: { name: "Jordan Avery" },
          items: [{ item_name: "Merino wool throw, oat", item_quantity: "1" }],
        },
      ],
      messages: [{ posted_by: "BUYER", time_posted: at(-1), content: "My throw never arrived. I want a refund." }],
    },
    {
      createdAt: at(-12),
      buyerName: "Jordan Avery",
      buyerEmail: "jordan.avery@example.com",
      shipTo: "Portland, OR, US",
      items: [{ name: "Merino wool throw, oat", quantity: 1, unitPrice: "189.00" }],
      total: "189.00",
      carrier: "USPS",
      trackingNumber: "9400 1112 0206 1234 5678 90",
      shippedAt: at(-11),
      deliveredAt: at(-7),
      signedBy: "J AVERY",
      notes: ["Shipped with signature confirmation (order over $150)."],
    },
    [{ tracking_number: "9400111202061234567890", carrier: "USPS", status: "DELIVERED", shipment_date: at(-11).slice(0, 10) }],
  ),
  fixture(
    2,
    {
      create_time: at(-2),
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "12.00" },
      dispute_life_cycle_stage: "INQUIRY",
      seller_response_due_date: at(8),
      disputed_transactions: [
        {
          create_time: at(-15),
          gross_amount: { currency_code: "USD", value: "12.00" },
          buyer: { name: "Sam Okafor" },
          items: [{ item_name: "Beeswax tealights, 6 pack", item_quantity: "1" }],
        },
      ],
      messages: [{ posted_by: "BUYER", time_posted: at(-2), content: "Never got my tealights, it's been two weeks." }],
    },
    {
      createdAt: at(-15),
      buyerName: "Sam Okafor",
      buyerEmail: "sam.okafor@example.com",
      shipTo: "Leeds, GB",
      items: [{ name: "Beeswax tealights, 6 pack", quantity: 1, unitPrice: "12.00" }],
      total: "12.00",
      carrier: "Royal Mail",
      shippedAt: at(-14),
      notes: ["Sent as a large letter without tracking to keep shipping cheap."],
    },
  ),
  fixture(
    3,
    {
      create_time: at(-1),
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "95.00" },
      dispute_life_cycle_stage: "INQUIRY",
      seller_response_due_date: at(10),
      disputed_transactions: [
        {
          create_time: at(-9),
          gross_amount: { currency_code: "USD", value: "95.00" },
          buyer: { name: "Priya Nair" },
          items: [{ item_name: "Ceramic table lamp, sage", item_quantity: "1" }],
        },
      ],
      messages: [
        {
          posted_by: "BUYER",
          time_posted: at(-1),
          content: "The lamp base arrived with a crack down one side. I'd still like a lamp that works.",
        },
      ],
    },
    {
      createdAt: at(-9),
      buyerName: "Priya Nair",
      buyerEmail: "priya.nair@example.com",
      shipTo: "Austin, TX, US",
      items: [{ name: "Ceramic table lamp, sage", quantity: 1, unitPrice: "95.00" }],
      total: "95.00",
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      shippedAt: at(-8),
      deliveredAt: at(-4),
      deliveryPhoto: true,
      notes: ["Packed in a single box without double-boxing."],
    },
    [{ tracking_number: "1Z999AA10123456784", carrier: "UPS", status: "DELIVERED", shipment_date: at(-8).slice(0, 10) }],
  ),
  fixture(
    4,
    {
      create_time: at(-3),
      reason: "UNAUTHORISED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "240.00" },
      dispute_life_cycle_stage: "CHARGEBACK",
      seller_response_due_date: at(4),
      disputed_transactions: [
        {
          create_time: at(-20),
          gross_amount: { currency_code: "USD", value: "240.00" },
          buyer: { name: "Morgan Lee" },
          items: [
            { item_name: "Merino wool throw, charcoal", item_quantity: "1" },
            { item_name: "Soy candle trio", item_quantity: "1" },
          ],
        },
      ],
      messages: [],
    },
    {
      createdAt: at(-20),
      buyerName: "Morgan Lee",
      buyerEmail: "morgan.lee@example.com",
      shipTo: "Denver, CO, US",
      items: [
        { name: "Merino wool throw, charcoal", quantity: 1, unitPrice: "189.00" },
        { name: "Soy candle trio", quantity: 1, unitPrice: "51.00" },
      ],
      total: "240.00",
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456785",
      shippedAt: at(-19),
      deliveredAt: at(-16),
      signedBy: "M LEE",
      notes: [
        "Shipped to the address on the buyer's PayPal account.",
        "Buyer emailed on delivery day: 'Arrived, it's gorgeous, thank you!'",
      ],
    },
    [{ tracking_number: "1Z999AA10123456785", carrier: "UPS", status: "DELIVERED", shipment_date: at(-19).slice(0, 10) }],
  ),
  fixture(
    5,
    {
      create_time: at(-2),
      reason: "CREDIT_NOT_PROCESSED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "60.00" },
      dispute_life_cycle_stage: "INQUIRY",
      seller_response_due_date: at(8),
      disputed_transactions: [
        {
          create_time: at(-25),
          gross_amount: { currency_code: "USD", value: "60.00" },
          buyer: { name: "Alex Romero" },
          items: [{ item_name: "Linen cushion cover, pair", item_quantity: "1" }],
        },
      ],
      messages: [{ posted_by: "BUYER", time_posted: at(-2), content: "I returned the covers and still have no refund." }],
    },
    {
      createdAt: at(-25),
      buyerName: "Alex Romero",
      buyerEmail: "alex.romero@example.com",
      shipTo: "Chicago, IL, US",
      items: [{ name: "Linen cushion cover, pair", quantity: 1, unitPrice: "60.00" }],
      total: "60.00",
      carrier: "USPS",
      trackingNumber: "9400111202069876543210",
      shippedAt: at(-24),
      deliveredAt: at(-21),
      refunds: [{ refundId: "DEMO-REFUND-5", amount: "60.00", at: at(-3) }],
      notes: ["Return received 4 days ago; full refund issued the next day."],
    },
    [{ tracking_number: "9400111202069876543210", carrier: "USPS", status: "DELIVERED", shipment_date: at(-24).slice(0, 10) }],
  ),
  fixture(
    6,
    {
      create_time: at(-1),
      reason: "DUPLICATE_TRANSACTION",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "6.00" },
      dispute_life_cycle_stage: "INQUIRY",
      seller_response_due_date: at(9),
      disputed_transactions: [
        {
          create_time: at(-3),
          gross_amount: { currency_code: "USD", value: "6.00" },
          buyer: { name: "Casey Brooks" },
          items: [{ item_name: "Cotton wick refill", item_quantity: "1" }],
        },
      ],
      messages: [{ posted_by: "BUYER", time_posted: at(-1), content: "I was charged twice for one wick refill." }],
    },
    {
      createdAt: at(-3),
      buyerName: "Casey Brooks",
      buyerEmail: "casey.brooks@example.com",
      shipTo: "Boston, MA, US",
      items: [{ name: "Cotton wick refill", quantity: 1, unitPrice: "6.00" }],
      total: "6.00",
      notes: ["Checkout retried after a timeout; two $6.00 payments were captured for one order."],
    },
  ),
];
