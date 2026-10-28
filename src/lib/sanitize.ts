// Smaller models occasionally leak tool-call markup into a string field; cut it off there.
const LEAK = /<\/?(?:parameter\b|invoke\b|antml:|[a-z_]+>)/;
export function stripMarkup<T>(value: T): T {
  if (typeof value === "string") {
    const i = value.search(LEAK);
    return (i === -1 ? value : value.slice(0, i).trimEnd()) as T;
  }
  if (Array.isArray(value)) return value.map(stripMarkup) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripMarkup(v)])) as T;
  }
  return value;
}
