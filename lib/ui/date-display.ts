const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isCalendarDate(value)) {
    throw new Error("Invalid calendar date.");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date.");
  return `${String(date.getUTCDate()).padStart(2, "0")}-${MONTHS[date.getUTCMonth()]}-${String(date.getUTCFullYear()).padStart(4, "0")}`;
}

export function parseDateInput(value: string): string | null {
  const match = /^(\d{2})-([a-z]{3})-(\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const month = MONTHS.findIndex((entry) => entry.toLowerCase() === match[2]!.toLowerCase());
  if (month < 0) return null;
  const iso = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]}`;
  return isCalendarDate(iso) ? iso : null;
}

export function dateInputError(value: string, min?: string, max?: string): string {
  if (value === "") return "";
  const iso = parseDateInput(value);
  if (!iso) return "Introduceți o dată validă în formatul 19-Oct-2026.";
  if (min && iso < min) return `Data nu poate preceda ${formatDate(min)}.`;
  if (max && iso > max) return `Data nu poate depăși ${formatDate(max)}.`;
  return "";
}
