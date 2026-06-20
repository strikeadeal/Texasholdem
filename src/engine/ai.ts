/**
 * ai.ts — AI decision-making for bot players.
 * Each bot has a Personality that biases its action selection.
 * TODO: implement in step 3 (AI agent).
 */
import type { GameState, Action, SeatState } from './types';

/**
 * Choose an action for the bot at `seatIndex`.
 * Receives the full GameState (hole cards for all seats are present).
 * Returns an Action consistent with getLegalActions().
 */
export function chooseAction(state: GameState, seatIndex: number): Action {
  throw new Error('not implemented');
}

/**
 * Estimate hand strength as a value in [0, 1] using Monte Carlo simulation.
 * Used by chooseAction internally; exported for testing.
 *
 * @param seat      The seat whose hole cards to evaluate.
 * @param board     Community cards dealt so far (0, 3, 4, or 5 cards).
 * @param iterations Number of random simulations (default 500).
 */
export function estimateEquity(
  seat: SeatState,
  board: GameState['board'],
  iterations?: number,
): number {
  throw new Error('not implemented');
}
