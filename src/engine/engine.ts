/**
 * engine.ts — pure state-transition functions for Texas Hold'em.
 * All functions are pure: (GameState, ...) => GameState.
 * The human player is always seat index 0.
 * TODO: implement in step 2 (engine agent).
 */
import type { GameState, GameConfig, Action, LegalActions, HandResult, Player } from './types';

/**
 * Create the initial GameState for a new table.
 * @param config  Blind / stack configuration.
 * @param players Ordered array of players; index 0 must be the human.
 */
export function createTable(config: GameConfig, players: Player[]): GameState {
  throw new Error('not implemented');
}

/**
 * Start a new hand: post blinds, deal hole cards, advance to preflop.
 * Button advances by one seat from the previous hand.
 */
export function startHand(state: GameState): GameState {
  throw new Error('not implemented');
}

/**
 * Apply a player action (fold/check/call/bet/raise/allin) from a given seat.
 * Advances toActIndex and, if the round is closed, advances the phase.
 */
export function applyAction(state: GameState, seatIndex: number, action: Action): GameState {
  throw new Error('not implemented');
}

/**
 * Return which actions are legal for the seat that is currently to act.
 */
export function getLegalActions(state: GameState): LegalActions {
  throw new Error('not implemented');
}

/**
 * Deal the next community cards (flop / turn / river) and open next betting round.
 * Call after a betting round closes and phase is not yet 'showdown'.
 */
export function dealNextStreet(state: GameState): GameState {
  throw new Error('not implemented');
}

/**
 * Run the showdown: evaluate all non-folded hands, award pots, return result.
 * The returned GameState has phase='handover' and lastResult populated.
 */
export function runShowdown(state: GameState): GameState {
  throw new Error('not implemented');
}

/**
 * Distribute a single pot among eligible players based on hand rankings.
 * Used internally by runShowdown; exported for testing.
 */
export function distributePots(state: GameState): HandResult {
  throw new Error('not implemented');
}
