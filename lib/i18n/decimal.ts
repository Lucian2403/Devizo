const PLAIN_DECIMAL = /^([+-]?)(\d+)(?:\.(\d*))?$/;

export function formatDecimalRo(value: string): string {
  const match = PLAIN_DECIMAL.exec(value);
  if (!match) return value;

  const [, sign, whole, fraction = ""] = match;
  const normalizedFraction = fraction.replace(/0+$/, "");
  return `${sign}${whole}${normalizedFraction ? `,${normalizedFraction}` : ""}`;
}
