/**
 * cards.ts — deck creation, shuffling, and dealing utilities.
 * TODO: implement in step 2 (engine agent).
 */
import type { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Return a fresh, unshuffled 52-card deck. */
export function createDeck(): Card[] {
  throw new Error('not implemented');
}

/** Shuffle a deck in place using Fisher-Yates and return it. */
export function shuffle(deck: Card[]): Card[] {
  throw new Error('not implemented');
}

/** Deal `n` cards from the top of the deck; mutates deck in place. */
export function deal(deck: Card[], n: number): Card[] {
  throw new Error('not implemented');
}

// Export constants so other modules can reference them without re-declaring.
export { SUITS, RANKS };
