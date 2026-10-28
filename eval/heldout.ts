import type { Dispute, DisputeReason, Tracker } from "../src/lib/paypal/types";
import type { FulfillmentRecord } from "../src/lib/fulfillment";
import type { BuyerHistory } from "../src/lib/source";
import type { EvalCase, Lean } from "./dataset";

// Held-out set: messy, independently written disputes. Written from the seller's side,
// without looking at how the agent works.

type Spec = {
  n: number;
  title: string;
  expected: Lean[];
  why: string;
  reason: DisputeReason;
  stage: "INQUIRY" | "CHARGEBACK";
  amount: string;
  currency: "USD" | "EUR" | "CHF";
  created: string; // ISO
  buyer: string; // name
  email: string;
  item: string;
  buyerMsg?: string;
  buyerMsgAt?: string;
  trackers?: Omit<Tracker, "transaction_id">[];
  record: Omit<FulfillmentRecord, "orderId" | "captureId" | "buyerName" | "buyerEmail" | "items" | "total"> & {
    items?: FulfillmentRecord["items"];
  };
  history?: Partial<BuyerHistory>;
  extraMessages?: Dispute["messages"];
};

const plusDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().replace(".000Z", "Z");

export function mk(s: Spec): EvalCase {
  const cap = `HO-CAP-${s.n}`;
  const num = String(s.n).padStart(2, "0");
  const dispute: Dispute = {
    dispute_id: `PP-D-HO-${s.n}`,
    create_time: s.created,
    update_time: s.created,
    reason: s.reason,
    status: "WAITING_FOR_SELLER_RESPONSE",
    dispute_state: "OPEN_INQUIRIES",
    dispute_amount: { currency_code: s.currency, value: s.amount },
    dispute_life_cycle_stage: s.stage,
    dispute_channel: "INTERNAL",
    seller_response_due_date: plusDays(s.created, 9),
    disputed_transactions: [
      {
        seller_transaction_id: cap,
        create_time: s.record.createdAt,
        gross_amount: { currency_code: s.currency, value: s.amount },
        buyer: { name: s.buyer, email: s.email },
        items: [{ item_name: s.item, item_quantity: "1" }],
      },
    ],
    messages: [
      ...(s.buyerMsg ? [{ posted_by: "BUYER", time_posted: s.buyerMsgAt ?? s.created, content: s.buyerMsg }] : []),
      ...(s.extraMessages ?? []),
    ],
  };
  return {
    id: `HO-${num}`,
    title: s.title,
    expected: s.expected,
    why: s.why,
    dispute,
    trackers: (s.trackers ?? []).map((t) => ({ transaction_id: cap, ...t })),
    record: {
      orderId: `HO-ORDER-${s.n}`,
      captureId: cap,
      buyerName: s.buyer,
      buyerEmail: s.email,
      items: s.record.items ?? [{ name: s.item, quantity: 1, unitPrice: s.amount }],
      total: s.amount,
      ...s.record,
    },
    history: s.history,
  };
}

export const heldout: EvalCase[] = [
  mk({
    n: 1,
    title: "Swiss Post delivered, signed, German buyer says nothing arrived",
    expected: ["FIGHT"],
    why: "Tracker shows delivered and signed at the order address; this is the textbook seller-protection case.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: "312.00",
    currency: "CHF",
    created: "2026-10-20T08:14:00Z",
    buyer: "Reto Camenzind",
    email: "reto.camenzind@example.com",
    item: "Wool throw, charcoal, large",
    buyerMsg: "Hallo, mein Paket ist nie angekommen. Ich war die ganze Woche zuhause und niemand hat geklingelt. Bitte Geld zurueck!!",
    trackers: [
      { tracking_number: "98.34.567890.12345678", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-10-08", last_updated_time: "2026-10-10T14:22:00Z" },
    ],
    record: {
      createdAt: "2026-10-07T19:40:00Z",
      shipTo: "Reto Camenzind, Bahnhofstrasse 14, 6003 Luzern, CH",
      carrier: "Swiss Post",
      trackingNumber: "98.34.567890.12345678",
      shippedAt: "2026-10-08",
      deliveredAt: "2026-10-10",
      signedBy: "R. Camenzind",
    },
    history: { orders: 0, totalSpent: 0, firstOrderAt: null, priorDisputes: 0 },
  }),

  mk({
    n: 2,
    title: "Deutsche Post number with no scans after 13 days to Germany",
    expected: ["ACCEPT"],
    why: "A tracking number with no scan at all is no proof of delivery, and 13 days on a EU lane makes loss likely.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: "84.50",
    currency: "EUR",
    created: "2026-10-20T10:02:00Z",
    buyer: "Heike Brandt",
    email: "heike.brandt@example.com",
    item: "Beeswax candle set (6)",
    buyerMsg: "Seit fast 2 Wochen nichts erhalten. Sendungsverfolgung zeigt gar nichts. Ich will mein Geld zurueck.",
    trackers: [{ tracking_number: "RR112233445DE", status: "SHIPPED", carrier: "DEUTSCHE_DE", shipment_date: "2026-10-07" }],
    record: {
      createdAt: "2026-10-06T11:05:00Z",
      shipTo: "Heike Brandt, Lindenweg 3, 50667 Koeln, DE",
      carrier: "Deutsche Post",
      trackingNumber: "RR112233445DE",
      shippedAt: "2026-10-07",
      notes: ["Handed over at the counter, receipt not kept"],
    },
  }),

  mk({
    n: 3,
    title: "Shop record number has a typo, PayPal tracker shows La Poste delivered",
    expected: ["FIGHT"],
    why: "The tracker PayPal holds on this transaction shows delivery to the same city and postcode; the record typo is a clerical slip to explain, not a loss.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "CHARGEBACK",
    amount: "176.00",
    currency: "EUR",
    created: "2026-10-19T16:30:00Z",
    buyer: "Camille Fournier",
    email: "camille.fournier@example.com",
    item: "Ceramic table lamp, sand",
    buyerMsg: "Je n'ai jamais recu ma lampe. Le colis n'est pas arrive et personne ne repond a mes mails. Je demande le remboursement complet.",
    trackers: [
      { tracking_number: "6A18273645901", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Colissimo / La Poste", shipment_date: "2026-10-05", last_updated_time: "2026-10-09T10:15:00Z" },
    ],
    record: {
      createdAt: "2026-10-04T09:12:00Z",
      shipTo: "Camille Fournier, 22 rue des Tilleuls, 69003 Lyon, FR",
      carrier: "La Poste",
      trackingNumber: "6A18273645910",
      shippedAt: "2026-10-05",
      notes: ["Tracking number typed by hand when label printed"],
    },
    history: { orders: 1, totalSpent: 58, firstOrderAt: "2026-03-02T12:00:00Z", priorDisputes: 0 },
  }),

  mk({
    n: 4,
    title: "Royal Mail, only 'SHIPPED', over signature threshold, no signature",
    expected: ["ACCEPT"],
    why: "Over the shop's signature limit but shipped without one, and no delivery scan exists; nothing proves the parcel arrived.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: "238.00",
    currency: "USD",
    created: "2026-10-20T13:45:00Z",
    buyer: "Oliver Pritchard",
    email: "oliver.pritchard@example.com",
    item: "Lambswool throw, heather, king",
    buyerMsg: "Still waiting after 3 weeks. Royal Mail says they have nothing on this. Please refund.",
    trackers: [{ tracking_number: "AB123456789GB", status: "SHIPPED", carrier: "ROYAL_MAIL", shipment_date: "2026-09-29" }],
    record: {
      createdAt: "2026-09-28T17:20:00Z",
      shipTo: "Oliver Pritchard, 14 Mill Lane, Bristol BS1 4DJ, GB",
      carrier: "Royal Mail",
      trackingNumber: "AB123456789GB",
      shippedAt: "2026-09-29",
      notes: ["Sent as standard tracked, signature not selected"],
    },
  }),

  mk({
    n: 5,
    title: "Record says 'delivered' without date or number, Italian chargeback",
    expected: ["ACCEPT"],
    why: "A bare statement that it was delivered is not evidence: no tracking, no date, no scan, no signature.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "CHARGEBACK",
    amount: "129.00",
    currency: "EUR",
    created: "2026-10-18T07:50:00Z",
    buyer: "Giulia Ferraro",
    email: "giulia.ferraro@example.com",
    item: "Soy candle trio, amber",
    buyerMsg: "Non ho mai ricevuto il pacco. Ho aspettato un mese. Voglio il rimborso, altrimenti vado dalla banca.",
    record: {
      createdAt: "2026-09-10T14:00:00Z",
      shipTo: "Giulia Ferraro, Via Roma 45, 20121 Milano, IT",
      carrier: "Poste Italiane",
      notes: ["delivered", "customer wrote once asking for update, replied it was on its way"],
    },
  }),

  mk({
    n: 6,
    title: "German buyer says lamp colour is different, delivered per DHL",
    expected: ["OFFER"],
    why: "Not-as-described is outside seller protection, but a handmade glaze varies, so a partial refund beats losing the full amount.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    stage: "INQUIRY",
    amount: "149.00",
    currency: "EUR",
    created: "2026-10-20T09:30:00Z",
    buyer: "Jonas Kessler",
    email: "jonas.kessler@example.com",
    item: "Ceramic table lamp, forest green",
    buyerMsg: "Die Lampe ist viel heller als auf den Fotos, eher Mintgruen als Waldgruen. Gefaellt mir so nicht. Ich moechte entweder Geld zurueck oder Umtausch.",
    trackers: [
      { tracking_number: "00340434161094042557", status: "DELIVERED", carrier: "DHL", shipment_date: "2026-10-12", last_updated_time: "2026-10-14T11:00:00Z" },
    ],
    record: {
      createdAt: "2026-10-11T20:15:00Z",
      shipTo: "Jonas Kessler, Gartenstrasse 8, 80331 Muenchen, DE",
      carrier: "DHL",
      trackingNumber: "00340434161094042557",
      shippedAt: "2026-10-12",
      deliveredAt: "2026-10-14",
      notes: ["Listing says: glaze colour varies slightly from piece to piece", "Buyer has not offered photos yet"],
    },
  }),

  mk({
    n: 7,
    title: "Unauthorised chargeback, signed delivery to the order address, repeat buyer",
    expected: ["FIGHT"],
    why: "Signed delivery to the transaction address plus prior undisputed orders is strong evidence against 'unauthorised'.",
    reason: "UNAUTHORISED",
    stage: "CHARGEBACK",
    amount: "340.00",
    currency: "USD",
    created: "2026-10-19T12:00:00Z",
    buyer: "Martin Aebi",
    email: "martin.aebi@example.com",
    item: "Floor lamp, oak and linen",
    buyerMsg: "I did not authorise this payment. Someone used my account.",
    trackers: [
      { tracking_number: "99.60.123456.00001234", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-09-30", last_updated_time: "2026-10-02T09:41:00Z" },
    ],
    record: {
      createdAt: "2026-09-29T21:05:00Z",
      shipTo: "Martin Aebi, Dorfstrasse 31, 3011 Bern, CH",
      carrier: "Swiss Post",
      trackingNumber: "99.60.123456.00001234",
      shippedAt: "2026-09-30",
      deliveredAt: "2026-10-02",
      signedBy: "M. Aebi",
    },
    history: { orders: 4, totalSpent: 611.5, firstOrderAt: "2025-11-14T10:00:00Z", priorDisputes: 0 },
  }),

  mk({
    n: 8,
    title: "Unauthorised claim, parcel went to an address that is not the PayPal one",
    expected: ["ACCEPT"],
    why: "Shipping to an address other than the transaction address voids seller protection, whatever the buyer asked by email.",
    reason: "UNAUTHORISED",
    stage: "CHARGEBACK",
    amount: "265.00",
    currency: "EUR",
    created: "2026-10-18T15:20:00Z",
    buyer: "Daniel Roth",
    email: "daniel.roth@example.com",
    item: "Wool throw set (2), ivory",
    buyerMsg: "Ich habe diese Bestellung nicht gemacht und nichts erhalten.",
    trackers: [
      { tracking_number: "JJD014600006541892301", status: "DELIVERED", carrier: "DHL", shipment_date: "2026-10-03", last_updated_time: "2026-10-06T16:30:00Z" },
    ],
    record: {
      createdAt: "2026-10-02T23:48:00Z",
      shipTo: "D. Roth c/o Packstation 142, 10115 Berlin, DE",
      carrier: "DHL",
      trackingNumber: "JJD014600006541892301",
      shippedAt: "2026-10-03",
      deliveredAt: "2026-10-06",
      notes: [
        "Order email asked to ship to a parcel locker, different from the PayPal confirmed address in Hamburg",
        "Same IP country mismatch flagged at checkout, order was not reviewed",
      ],
    },
    history: { orders: 0, totalSpent: 0, firstOrderAt: null, priorDisputes: 0 },
  }),

  mk({
    n: 9,
    title: "'Duplicate' claim, but the second charge is a separate order with its own shipment",
    expected: ["FIGHT"],
    why: "Two different items were ordered and shipped separately, so the charges are not duplicates; show both orders.",
    reason: "DUPLICATE_TRANSACTION",
    stage: "INQUIRY",
    amount: "92.00",
    currency: "CHF",
    created: "2026-10-20T11:11:00Z",
    buyer: "Sophie Baumann",
    email: "sophie.baumann@example.com",
    item: "Beeswax taper candles (12)",
    buyerMsg: "Ich wurde zweimal belastet am selben Tag. Bitte eine Zahlung zurueckerstatten.",
    trackers: [
      { tracking_number: "98.34.100200.55501111", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-10-09", last_updated_time: "2026-10-10T10:00:00Z" },
    ],
    record: {
      createdAt: "2026-10-08T18:30:00Z",
      shipTo: "Sophie Baumann, Seestrasse 77, 8002 Zuerich, CH",
      carrier: "Swiss Post",
      trackingNumber: "98.34.100200.55501111",
      shippedAt: "2026-10-09",
      deliveredAt: "2026-10-10",
      notes: [
        "Same buyer placed a second order 6 minutes later (candle holders, CHF 92.00, order HO-ORDER-9B), shipped 2026-10-09 under 98.34.100200.55501112",
        "Both orders are different products at the same price",
      ],
    },
    history: { orders: 2, totalSpent: 184, firstOrderAt: "2026-10-08T18:30:00Z", priorDisputes: 0 },
  }),

  mk({
    n: 10,
    title: "Genuine duplicate: one order captured twice, second never refunded",
    expected: ["ACCEPT"],
    why: "The shop's own notes confirm two captures for one shipment; refunding the duplicate is right and fighting would fail.",
    reason: "DUPLICATE_TRANSACTION",
    stage: "INQUIRY",
    amount: "128.00",
    currency: "USD",
    created: "2026-10-20T06:25:00Z",
    buyer: "Lena Hartmann",
    email: "lena.hartmann@example.com",
    item: "Soy candle trio, sage",
    buyerMsg: "I was charged twice for the same order. I only got one parcel. Please refund the second one.",
    trackers: [
      { tracking_number: "RR998877665DE", status: "DELIVERED", carrier: "DEUTSCHE_DE", shipment_date: "2026-10-10", last_updated_time: "2026-10-13T12:00:00Z" },
    ],
    record: {
      createdAt: "2026-10-09T10:00:00Z",
      shipTo: "Lena Hartmann, Ahornallee 5, 04109 Leipzig, DE",
      carrier: "Deutsche Post",
      trackingNumber: "RR998877665DE",
      shippedAt: "2026-10-10",
      deliveredAt: "2026-10-13",
      notes: ["Checkout page froze, customer paid again; two captures, one order, one shipment", "Second capture not yet refunded"],
    },
  }),

  mk({
    n: 11,
    title: "Italian buyer returned item, got refund net of return label, disputes the difference",
    expected: ["FIGHT"],
    why: "Refund was issued within policy (buyer pays return shipping) and is on record; show proof of refund.",
    reason: "CREDIT_NOT_PROCESSED",
    stage: "INQUIRY",
    amount: "95.00",
    currency: "EUR",
    created: "2026-10-20T14:05:00Z",
    buyer: "Marco Bellini",
    email: "marco.bellini@example.com",
    item: "Wool throw, oatmeal, medium",
    buyerMsg: "Ho restituito il plaid ma mi avete rimborsato solo 70 euro. Mancano 25 euro, li voglio indietro.",
    trackers: [
      { tracking_number: "RB445566778IT", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Poste Italiane", shipment_date: "2026-09-18", last_updated_time: "2026-09-22T09:00:00Z" },
    ],
    record: {
      createdAt: "2026-09-17T16:00:00Z",
      shipTo: "Marco Bellini, Corso Vittorio 12, 10121 Torino, IT",
      carrier: "Poste Italiane",
      trackingNumber: "RB445566778IT",
      shippedAt: "2026-09-18",
      deliveredAt: "2026-09-22",
      refunds: [{ refundId: "HO-REF-11A", amount: "70.00", at: "2026-10-14T10:20:00Z" }],
      notes: ["Return received 2026-10-12, unused and in original packaging", "Refund minus EUR 25 return shipping per 30-day returns policy, buyer was told by email"],
    },
  }),

  mk({
    n: 12,
    title: "Cracked lampshade corner, small refund already paid, buyer wants all of it back and keeps the item",
    expected: ["OFFER"],
    why: "Damage is real but minor and the item is kept; a larger partial refund settles it, while the full amount overpays.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    stage: "CHARGEBACK",
    amount: "120.00",
    currency: "USD",
    created: "2026-10-19T09:10:00Z",
    buyer: "Isabelle Moreau",
    email: "isabelle.moreau@example.com",
    item: "Linen lampshade with brass fitting",
    buyerMsg: "Je suis tres decue!! Le coin est abime, vous m'avez rembourse 30 dollars comme si c'etait rien. Je veux TOUT mon argent.",
    trackers: [
      { tracking_number: "LX556677889CH", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-09-26", last_updated_time: "2026-09-30T13:00:00Z" },
    ],
    record: {
      createdAt: "2026-09-25T12:30:00Z",
      shipTo: "Isabelle Moreau, 5 chemin des Vignes, 1204 Geneve, CH",
      carrier: "Swiss Post",
      trackingNumber: "LX556677889CH",
      shippedAt: "2026-09-26",
      deliveredAt: "2026-09-30",
      refunds: [{ refundId: "HO-REF-12A", amount: "30.00", at: "2026-10-03T08:00:00Z" }],
      notes: ["Buyer sent photo: 2 cm crease on one corner of the shade, lamp itself fine", "Buyer did not offer to return the item"],
    },
  }),

  mk({
    n: 13,
    title: "High value, delivery scan only, no signature although shop policy requires it",
    expected: ["FIGHT", "ACCEPT"],
    why: "Delivered per PayPal-visible tracking to the right address, but missing signature on a 500+ order is weak; either course is defensible.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: "560.00",
    currency: "CHF",
    created: "2026-10-20T08:55:00Z",
    buyer: "Andreas Winkler",
    email: "andreas.winkler@example.com",
    item: "Handwoven wool throw collection (3)",
    buyerMsg: "Paket wurde laut Post zugestellt, aber ich habe nichts bekommen. Vielleicht Nachbar? Habe gefragt, niemand hat es.",
    trackers: [
      { tracking_number: "98.34.900800.77701234", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-10-05", last_updated_time: "2026-10-07T11:32:00Z" },
    ],
    record: {
      createdAt: "2026-10-04T15:45:00Z",
      shipTo: "Andreas Winkler, Birkenweg 2, 9000 St. Gallen, CH",
      carrier: "Swiss Post",
      trackingNumber: "98.34.900800.77701234",
      shippedAt: "2026-10-05",
      deliveredAt: "2026-10-07",
      notes: ["Shipped standard parcel; signature option was not booked"],
    },
    history: { orders: 1, totalSpent: 74, firstOrderAt: "2026-02-11T09:00:00Z", priorDisputes: 0 },
  }),

  mk({
    n: 14,
    title: "Delivered scan shows a different postcode than the address on the order",
    expected: ["OFFER", "ACCEPT"],
    why: "Record admits an address typo and the scan's postcode does not match, so delivery to the buyer is unproven and protection fails; make good or refund.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "CHARGEBACK",
    amount: "205.00",
    currency: "CHF",
    created: "2026-10-18T10:40:00Z",
    buyer: "Nadine Keller",
    email: "nadine.keller@example.com",
    item: "Ceramic table lamp, charcoal",
    buyerMsg: "Mein Paket wurde laut Tracking geliefert, aber nicht bei mir. Ich wohne in 8044, nicht 8004.",
    trackers: [
      { tracking_number: "98.34.222333.44409876", status: "DELIVERED", carrier: "OTHER", carrier_name_other: "Swiss Post", shipment_date: "2026-10-02", last_updated_time: "2026-10-05T15:10:00Z" },
    ],
    record: {
      createdAt: "2026-10-01T13:20:00Z",
      shipTo: "Nadine Keller, Zürichbergstrasse 40, 8004 Zuerich, CH",
      carrier: "Swiss Post",
      trackingNumber: "98.34.222333.44409876",
      shippedAt: "2026-10-02",
      deliveredAt: "2026-10-05",
      notes: ["Postcode typed as 8004; customer profile says 8044 Zuerich"],
    },
    history: { orders: 2, totalSpent: 96, firstOrderAt: "2025-12-01T10:00:00Z", priorDisputes: 0 },
  }),

  mk({
    n: 15,
    title: "Poste Italiane parcel still in transit 6 days after dispatch, impatient buyer",
    expected: ["FIGHT", "OFFER"],
    why: "Movement is visible and the window is not exceeded; show tracking and ask for time, with a refund fallback if it stalls.",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: "74.00",
    currency: "EUR",
    created: "2026-10-20T17:05:00Z",
    buyer: "Chiara Romano",
    email: "chiara.romano@example.com",
    item: "Beeswax candle set (4) and holder",
    buyerMsg: "Dove e il mio ordine?? Sono passati quasi 10 giorni dal pagamento e non e arrivato nulla.",
    trackers: [
      { tracking_number: "RB667788990IT", status: "IN_TRANSIT", carrier: "OTHER", carrier_name_other: "Poste Italiane", shipment_date: "2026-10-14", last_updated_time: "2026-10-19T08:30:00Z" },
    ],
    record: {
      createdAt: "2026-10-11T12:00:00Z",
      shipTo: "Chiara Romano, Via Garibaldi 9, 00184 Roma, IT",
      carrier: "Poste Italiane",
      trackingNumber: "RB667788990IT",
      shippedAt: "2026-10-14",
      notes: ["Listing quotes 7 to 14 days to Italy", "Last scan: arrived at Milano sorting centre"],
    },
  }),
];
