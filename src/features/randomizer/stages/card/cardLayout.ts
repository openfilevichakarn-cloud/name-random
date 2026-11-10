/** Width / height of a card. */
export const CARD_ASPECT = 0.72
export const CARD_GAP = 12
const MAX_CARD_WIDTH = 190
export const MAX_CARDS = 15
const MIN_CARDS = 3

export interface CardLayout {
  columns: number
  rows: number
  /** Card width in CSS pixels. */
  cardWidth: number
}

/** Find the grid that gives `count` cards the largest size inside a `width` × `height` box. */
export function layoutCards(count: number, width: number, height: number): CardLayout {
  let best: CardLayout = { columns: Math.max(1, count), rows: 1, cardWidth: 0 }
  if (count <= 0 || width <= 0 || height <= 0) return best
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns)
    const byWidth = (width - CARD_GAP * (columns - 1)) / columns
    const byHeight = ((height - CARD_GAP * (rows - 1)) / rows) * CARD_ASPECT
    const cardWidth = Math.min(byWidth, byHeight, MAX_CARD_WIDTH)
    if (cardWidth > best.cardWidth) best = { columns, rows, cardWidth }
  }
  return { ...best, cardWidth: Math.max(0, Math.floor(best.cardWidth)) }
}

/**
 * How many cards the stage can show while keeping each one comfortably tappable.
 * Used when dealing, so the deal never produces cards that are too small to pick.
 */
export function getCardCapacity(width: number, height: number): number {
  const minWidth = width < 480 ? 64 : 92
  for (let count = MAX_CARDS; count > MIN_CARDS; count -= 1) {
    if (layoutCards(count, width, height).cardWidth >= minWidth) return count
  }
  return MIN_CARDS
}
