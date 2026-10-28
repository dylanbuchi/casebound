// Demo store catalog. Prices are set on the server; the browser only sends a SKU.
export const catalog = [
  { sku: "THROW-OAT", name: "Merino wool throw, oat", price: "189.00", blurb: "Woven in small batches. Ships with signature." },
  { sku: "LAMP-SAGE", name: "Ceramic table lamp, sage", price: "95.00", blurb: "Hand-thrown base, linen shade." },
  { sku: "CUSHION-LINEN", name: "Linen cushion cover, pair", price: "60.00", blurb: "Stonewashed linen, hidden zip." },
  { sku: "TEALIGHT-6", name: "Beeswax tealights, 6 pack", price: "12.00", blurb: "Pure beeswax, cotton wicks." },
] as const;

export type Sku = (typeof catalog)[number]["sku"];

export const findProduct = (sku: string) => catalog.find((p) => p.sku === sku);
