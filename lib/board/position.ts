// B2: card order inside a stage. Positions are floats; a moved card goes
// halfway between its new neighbours, so one move updates one row.

export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

/**
 * Position for a card dropped between `above` and `below` (either may be
 * missing at the ends of a column). Returns null when the gap is too small
 * and the column needs renumbering first.
 */
export function positionBetween(above: number | null, below: number | null): number | null {
  if (above === null && below === null) return 0;
  if (above === null) return (below as number) - POSITION_STEP;
  if (below === null) return above + POSITION_STEP;
  if (below - above < MIN_GAP) return null;
  return (above + below) / 2;
}

/** Evenly spaced positions for a whole column, in its current order. */
export function renumber(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * POSITION_STEP);
}
