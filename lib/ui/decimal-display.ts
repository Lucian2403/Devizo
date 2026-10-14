export function formatRomanianDecimal(value: string): string {
  const separator = value.indexOf(".");
  if (separator === -1) return value;

  const integer = value.slice(0, separator);
  const fraction = value.slice(separator + 1).replace(/0+$/, "");
  return fraction ? `${integer},${fraction}` : integer;
}
