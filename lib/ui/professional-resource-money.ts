export function formatProfessionalResourceMoney(
  value: string,
  currency: string,
): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const amount = `${negative ? "-" : ""}${groupedInteger}${
    normalizedFraction ? `,${normalizedFraction}` : ""
  }`;
  return `${amount} ${currency}`;
}
