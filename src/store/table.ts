/**
 * table.ts — Zustand store for the live table state.
 * TODO: wire to the engine in step 4 (wiring agent).
 */
import { create } from 'zustand';
import type { GameState, Action } from '../engine/types';

interface TableStore {
  /** The canonical game state, or null before the first hand. */
  game: GameState | null;

  /** Apply an action from the human player (seat 0). */
  dispatch: (action: Action) => void;

  /** Start a new hand (called automatically after handover). */
  startNextHand: () => void;

  /** Replace the entire game state (used for testing / replays). */
  setGame: (state: GameState) => void;
}

export const useTableStore = create<TableStore>()((set) => ({
  game: null,

  dispatch: (_action: Action) => {
    // TODO: call applyAction from engine.ts, then bot loop
    throw new Error('not implemented');
  },

  startNextHand: () => {
    // TODO: call startHand from engine.ts
    throw new Error('not implemented');
  },

  setGame: (state: GameState) => set({ game: state }),
}));
