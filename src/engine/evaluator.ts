/**
 * evaluator.ts — 5-card and 7-card hand evaluation.
 * TODO: implement in step 2 (engine agent).
 */
import type { Card, EvaluatedHand } from './types';

/**
 * Evaluate the best 5-card hand from up to 7 cards.
 * Returns an EvaluatedHand whose `ranks` array allows lexicographic comparison.
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  throw new Error('not implemented');
}

/**
 * Compare two evaluated hands.
 * Returns >0 if a wins, <0 if b wins, 0 if tie.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  throw new Error('not implemented');
}
