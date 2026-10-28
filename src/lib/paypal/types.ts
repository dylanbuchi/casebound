// Shapes follow the PayPal Disputes v1, Payments v2 and Orders v2 REST APIs.
// Only the fields the app reads are typed; everything else passes through.

export type Money = { currency_code: string; value: string };

export type DisputeReason =
  | "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
  | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
  | "UNAUTHORISED"
  | "CREDIT_NOT_PROCESSED"
  | "DUPLICATE_TRANSACTION"
  | "INCORRECT_AMOUNT"
  | "PAYMENT_BY_OTHER_MEANS"
  | "CANCELED_RECURRING_BILLING"
  | "PROBLEM_WITH_REMITTANCE"
  | "OTHER";

export type DisputeStatus =
  | "OPEN"
  | "WAITING_FOR_BUYER_RESPONSE"
  | "WAITING_FOR_SELLER_RESPONSE"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "OTHER";

export type DisputeSummary = {
  dispute_id: string;
  create_time: string;
  update_time: string;
  reason: DisputeReason;
  status: DisputeStatus;
  dispute_state?: string;
  dispute_amount: Money;
  dispute_life_cycle_stage?: "INQUIRY" | "CHARGEBACK" | "PRE_ARBITRATION" | "ARBITRATION";
  dispute_channel?: "INTERNAL" | "EXTERNAL";
  seller_response_due_date?: string;
};

export type DisputedTransaction = {
  seller_transaction_id?: string;
  buyer_transaction_id?: string;
  create_time?: string;
  transaction_status?: string;
  gross_amount?: Money;
  invoice_number?: string;
  custom?: string;
  buyer?: { name?: string; email?: string };
  seller?: { email?: string; merchant_id?: string; name?: string };
  items?: { item_id?: string; item_name?: string; item_quantity?: string; item_description?: string }[];
};

export type DisputeMessage = {
  posted_by: "BUYER" | "SELLER" | "ARBITER" | string;
  time_posted: string;
  content: string;
};

export type DisputeLink = { href: string; rel: string; method?: string };

export type Dispute = DisputeSummary & {
  disputed_transactions?: DisputedTransaction[];
  messages?: DisputeMessage[];
  outcome?: { outcome_code?: string; amount_refunded?: Money };
  adjudications?: { type: string; adjudication_time: string; reason?: string }[];
  offer?: { buyer_requested_amount?: Money; seller_offered_amount?: Money; offer_type?: string };
  evidences?: { evidence_type: string; notes?: string; date?: string }[];
  links?: DisputeLink[];
};

export type Tracker = {
  transaction_id?: string;
  tracking_number?: string;
  status?: string;
  carrier?: string;
  carrier_name_other?: string;
  shipment_date?: string;
  last_updated_time?: string;
};

export type Capture = {
  id: string;
  status: string;
  amount: Money;
  create_time?: string;
  invoice_id?: string;
  custom_id?: string;
  links?: DisputeLink[];
};

export type OrderSummary = {
  id: string;
  status: string;
  create_time?: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units?: {
    reference_id?: string;
    description?: string;
    amount?: Money;
    items?: { name: string; quantity: string; sku?: string; unit_amount?: Money; description?: string }[];
    shipping?: {
      name?: { full_name?: string };
      address?: { address_line_1?: string; admin_area_2?: string; postal_code?: string; country_code?: string };
      trackers?: { id: string; status?: string; items?: unknown[] }[];
    };
  }[];
};

export type OfferType = "REFUND" | "REFUND_WITH_RETURN" | "REFUND_WITH_REPLACEMENT" | "REPLACEMENT_WITHOUT_REFUND";

export type EvidenceInput = {
  evidence_type: "PROOF_OF_FULFILLMENT" | "PROOF_OF_REFUND" | "OTHER";
  evidence_info?: {
    tracking_info?: { carrier_name: string; carrier_name_other?: string; tracking_number: string }[];
    refund_ids?: { refund_id: string }[];
  };
  notes: string;
};
