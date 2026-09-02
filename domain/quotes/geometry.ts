import Decimal from "decimal.js";

/**
 * Deterministic geometry helpers for area take-off. The AI only supplies raw
 * structured dimensions and assumptions; ALL arithmetic happens here so results
 * are exact and reproducible (money/quantity math never runs in the LLM).
 *
 * Every dimension is a plain number in metres. Results are returned as canonical
 * decimal strings (m²) so they flow straight into the pricing layer.
 */

export interface Opening {
  width: number;
  height: number;
  // How many identical openings (defaults to 1).
  count?: number;
}

// Area of a single rectangular surface, e.g. one drywall wall panel.
export function rectangleArea(width: number, height: number): string {
  return new Decimal(width).mul(height).toDecimalPlaces(2).toString();
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

  const gross = new Decimal(length)
    .plus(width)
    .mul(2)
    .mul(height);

  let openingArea = new Decimal(0);
  for (const opening of openings) {
    const count = opening.count ?? 1;
    openingArea = openingArea.plus(
      new Decimal(opening.width).mul(opening.height).mul(count),
    );
  }

  const net = gross.minus(openingArea);
  // Never return a negative area if openings exceed the walls (bad input).
  const safe = net.isNegative() ? new Decimal(0) : net;
  return safe.toDecimalPlaces(2).toString();
}
