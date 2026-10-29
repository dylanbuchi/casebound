// The live progress lines the seller sees while the agent works the case.

const toolLabels: Record<string, string> = {
  get_dispute: "Reading the dispute on PayPal",
  get_payment: "Pulling the PayPal capture and order",
  get_shipment_tracking: "Checking PayPal shipment tracking",
  get_shop_records: "Opening the shop's fulfillment record",
  get_buyer_history: "Looking up this buyer's history",
  get_store_policy: "Reading the store policy",
  get_evidence_checklist: "Checking what evidence is on file",
  estimate_economics: "Running the money math",
  record_assessment: "Writing the recommendation",
  grounding_check: "Checking delivery, signature and reference claims against their source",
};

// A second call to the same tool gets its own line, so the list never shows the same step twice.
const againLabels: Record<string, [again: string, afterRewrite: string]> = {
  estimate_economics: ["Re-running the money math", "Re-running the money math after the rewrite"],
  record_assessment: ["Rewriting the recommendation", "Writing the recommendation again with the fixes"],
};

export function toolLabel(name: string, o: { repeat?: boolean; afterRewrite?: boolean } = {}): string {
  const base = toolLabels[name] ?? name;
  if (!o.repeat) return base;
  const again = againLabels[name];
  if (again) return o.afterRewrite ? again[1] : again[0];
  return `${base} again`;
}
