export function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 10_000_000 ? "compact" : "standard",
  }).format(value);
}

export function number(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
