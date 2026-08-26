// Formats a decimal-string money value with its currency code for display.
// Values are stored as canonical decimal strings, so we parse only for display.
export function formatMoney(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
