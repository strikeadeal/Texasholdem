/**
 * cards.ts — deck creation, shuffling, and dealing utilities.
 */
import type { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Return a fresh, unshuffled 52-card deck in deterministic order (suits × ranks). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Return a new shuffled copy of `deck` using Fisher–Yates.
 * @param deck  Input deck — not mutated.
 * @param rng   Optional RNG returning [0, 1). Defaults to crypto.getRandomValues.
 */
export function shuffle(deck: Card[], rng?: () => number): Card[] {
  const out = [...deck];
  const random = rng ?? cryptoRng;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function cryptoRng(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x1_0000_0000;
}

/**
 * Deal `n` cards from the top of `deck` (index 0 = top).
 * Returns `{ dealt: Card[], rest: Card[] }`.
 * Pure — does not mutate `deck`.
 */
export function deal(deck: Card[], n: number): { dealt: Card[]; rest: Card[] } {
  if (n > deck.length) throw new Error(`Cannot deal ${n} cards from a deck of ${deck.length}`);
  return {
    dealt: deck.slice(0, n),
    rest: deck.slice(n),
  };
}

// Export constants so other modules can reference them without re-declaring.
export { SUITS, RANKS };
