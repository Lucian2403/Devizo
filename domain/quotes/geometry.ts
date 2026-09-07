import Decimal from "decimal.js";

/**
 * Deterministic geometry helpers for area take-off. The AI only supplies raw
 * structured dimensions and assumptions; ALL arithmetic happens here so results
 * are exact and reproducible (money/quantity math never runs in the LLM).
 *
 * Every dimension is a plain number in metres. Results are returned as canonical
 * decimal strings (m²) so they flow straight into the pricing layer.
 *
 * BUSINESS RULE (explicit, single rule): surface areas are always NET — every
 * opening (window/door) is subtracted. There is no silent gross/net choice.
 * Rounding is always half-up to 2 decimals; decimals are never truncated.
 */

const AREA_DP = 2;

// Rounds a Decimal area to canonical 2dp half-up (never truncates).
function toArea(value: Decimal): string {
  const safe = value.isNegative() ? new Decimal(0) : value;
  return safe.toDecimalPlaces(AREA_DP, Decimal.ROUND_HALF_UP).toString();
}

export interface Opening {
  width: number;
  height: number;
  // How many identical openings (defaults to 1).
  count?: number;
}

// Sum of all opening areas (each width × height × count).
function openingsArea(openings: Opening[]): Decimal {
  let total = new Decimal(0);
  for (const opening of openings) {
    const count = opening.count ?? 1;
    total = total.plus(new Decimal(opening.width).mul(opening.height).mul(count));
  }
  return total;
}

// Area of a single rectangular surface, e.g. one drywall wall panel.
export function rectangleArea(width: number, height: number): string {
  return toArea(new Decimal(width).mul(height));
}

// Net area of a single rectangular wall/surface minus its openings.
export function rectangleNetArea(
  width: number,
  height: number,
  openings: Opening[] = [],
): string {
  const gross = new Decimal(width).mul(height);
  return toArea(gross.minus(openingsArea(openings)));
}

// Total area of the four walls of a rectangular room, minus openings.
//   perimeter walls = 2 × (length + width) × height
//   then subtract every opening (windows, doors).
export function roomWallArea(params: {
  length: number;
  width: number;
  height: number;
  openings?: Opening[];
}): string {
  const { length, width, height, openings = [] } = params;
  const gross = new Decimal(length).plus(width).mul(2).mul(height);
  return toArea(gross.minus(openingsArea(openings)));
}

// The shapes the AI may describe for an item. Deterministic code turns these
// plus raw dimensions into a NET area in m².
export type SurfaceShape =
  | "wall_rectangle" // a single wall panel: width × height − openings
  | "room_walls" // all four room walls: 2(l+w)h − openings
  | "floor" // room floor: length × width
  | "ceiling"; // room ceiling: length × width

export interface SurfaceDimensions {
  length?: number | null;
  width?: number | null;
  height?: number | null;
  openings?: Opening[];
}

// Computes a NET area (m², canonical string) for a shape + dimensions, or null
// when the required dimensions for that shape are missing. Floors/ceilings need
// length and width; walls need width/length and height.
export function computeSurfaceArea(
  shape: SurfaceShape,
  dims: SurfaceDimensions,
): string | null {
  const { length, width, height, openings = [] } = dims;
  const has = (n: number | null | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;

  switch (shape) {
    case "floor":
    case "ceiling":
      if (!has(length) || !has(width)) return null;
      return rectangleArea(length, width);
    case "room_walls":
      if (!has(length) || !has(width) || !has(height)) return null;
      return roomWallArea({ length, width, height, openings });
    case "wall_rectangle": {
      // A single wall may be given as width×height or length×height.
      const w = has(width) ? width : has(length) ? length : null;
      if (!has(w) || !has(height)) return null;
      return rectangleNetArea(w, height, openings);
    }
    default:
      return null;
  }
}

