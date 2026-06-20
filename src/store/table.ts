/**
 * table.ts — Zustand store for the live table state.
 *
 * Drive loop contract:
 *   createTable → startHand
 *   loop until phase === 'handover':
 *     if toActIndex !== null:
 *       human (seat 0) → wait for submitHumanAction
 *       bot             → chooseAction → applyAction → continue loop
 *     else if phase !== 'showdown':
 *       dealNextStreet (paced ~700–900ms)
 *     else:
 *       runShowdown → handover
 *   after handover: pause ~2.5s, auto-rebuy busted bots, offer human rebuy, startHand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, Action, LegalActions } from '../engine/types';
import {
  createTable,
  startHand,
  getLegalActions,
  applyAction,
  dealNextStreet,
  runShowdown,
  rebuy,
} from '../engine/engine';
import { chooseAction, BOT_ROSTER } from '../engine/ai';

// ---------------------------------------------------------------------------
// Config & Players
// ---------------------------------------------------------------------------

const TABLE_CONFIG = {
  smallBlind: 10,
  bigBlind: 20,
  startingStack: 1000,
  rebuyAmount: 1000,
};

const HUMAN_PLAYER = {
  id: 'hero',
  name: 'You',
  stack: TABLE_CONFIG.startingStack,
  isHuman: true,
  personality: 'balanced' as const,
};

const BOT_PLAYERS = BOT_ROSTER.slice(0, 5).map((bot, i) => ({
  id: `bot${i + 1}`,
  name: bot.name,
  stack: TABLE_CONFIG.startingStack,
  isHuman: false,
  personality: bot.personality,
}));

const ALL_PLAYERS = [HUMAN_PLAYER, ...BOT_PLAYERS];

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface TableStore {
  /** Full game state from the engine. */
  state: GameState | null;

  /** True once the human has tapped "Deal me in". */
  started: boolean;

  /** Legal actions for hero when it is their turn, null otherwise. */
  legalActions: LegalActions | null;

  /** Whether to reveal all hole cards (showdown + handover). */
  showdownReveal: boolean;

  /** True when the human is busted at handover and needs to rebuy. */
  awaitingHumanRebuy: boolean;

  /** Whether the loop is currently processing (prevents double-fire). */
  _processing: boolean;

  // ---- Public API ----

  /** Human taps "Deal me in" — creates table and deals first hand. */
  start: () => void;

  /** Human submits an action during their turn. */
  submitHumanAction: (action: Action) => void;

  /** Human chooses to rebuy after busting. */
  rebuyHuman: () => void;

  /** Skip the post-hand pause and start the next hand now. */
  nextHand: () => void;
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

function botDelay(): number {
  return 600 + Math.random() * 500; // 600–1100ms
}

function streetDelay(): number {
  return 700 + Math.random() * 200; // 700–900ms
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? Math.min(ms, 80) : ms));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// We keep timer IDs outside the store so they don't cause re-renders.
let _pendingTimer: ReturnType<typeof setTimeout> | null = null;

function clearPending() {
  if (_pendingTimer !== null) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }
}

export const useTableStore = create<TableStore>()(
  persist(
    (set, get) => {
      // -----------------------------------------------------------------------
      // Internal drive-loop runner
      // -----------------------------------------------------------------------

      async function runLoop(s: GameState): Promise<void> {
        // Re-entrant guard: mark processing
        set({ _processing: true });

        let current = s;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { phase, toActIndex } = current;

          // ---- HANDOVER: distribute pots, rebuy bots, offer human rebuy ----
          if (phase === 'handover') {
            // Reveal showdown cards for ~2.5s
            set({ state: current, showdownReveal: true, _processing: false, legalActions: null });

            await delay(2500);

            // Auto-rebuy any busted bot
            let afterRebuy = current;
            for (let i = 1; i < afterRebuy.seats.length; i++) {
              const seat = afterRebuy.seats[i];
              if (seat.player.stack <= 0 || seat.sittingOut) {
                afterRebuy = rebuy(afterRebuy, i);
              }
            }

            // Check human
            const heroSeat = afterRebuy.seats[0];
            const humanBusted = heroSeat.player.stack <= 0 || heroSeat.sittingOut;

            if (humanBusted) {
              set({
                state: afterRebuy,
                awaitingHumanRebuy: true,
                showdownReveal: true,
                _processing: false,
              });
              // Loop will resume when rebuyHuman() is called
              return;
            }

            // Auto-start next hand after a brief pause
            set({ state: afterRebuy });
            await delay(700);

            const next = startHand(afterRebuy);
            set({ state: next, showdownReveal: false, awaitingHumanRebuy: false });
            current = next;
            // Loop continues with new hand
            continue;
          }

          // ---- toActIndex is null: deal next street or run showdown ----
          if (toActIndex === null) {
            if (phase === 'showdown') {
              // Run showdown
              await delay(streetDelay());
              current = runShowdown(current);
              set({ state: current });
              continue; // will hit handover branch above
            } else {
              // Deal next street
              await delay(streetDelay());
              current = dealNextStreet(current);
              set({ state: current });
              continue;
            }
          }

          // ---- toActIndex is the hero (seat 0) — wait for human input ----
          if (toActIndex === 0) {
            const actions = getLegalActions(current);
            set({ state: current, legalActions: actions, _processing: false });
            return; // pause; submitHumanAction will resume
          }

          // ---- Bot's turn ----
          await delay(botDelay());

          // Guard: check state hasn't been replaced mid-wait
          const fresh = get().state;
          if (!fresh || fresh.toActIndex !== toActIndex) {
            // State changed externally; bail
            set({ _processing: false });
            return;
          }

          const botAction = chooseAction(current, toActIndex);
          current = applyAction(current, toActIndex, botAction);
          set({ state: current });
          // continue loop
        }
      }

      // -----------------------------------------------------------------------
      // Public methods
      // -----------------------------------------------------------------------

      function start() {
        clearPending();
        const table = createTable(TABLE_CONFIG, ALL_PLAYERS);
        const first = startHand(table);
        set({
          state: first,
          started: true,
          legalActions: null,
          showdownReveal: false,
          awaitingHumanRebuy: false,
          _processing: false,
        });
        runLoop(first);
      }

      function submitHumanAction(action: Action) {
        const { state, _processing } = get();
        if (!state || _processing) return;
        if (state.toActIndex !== 0) return;

        const next = applyAction(state, 0, action);
        set({ state: next, legalActions: null });
        runLoop(next);
      }

      function rebuyHuman() {
        const { state } = get();
        if (!state) return;

        const after = rebuy(state, 0);
        set({ awaitingHumanRebuy: false });

        const next = startHand(after);
        set({ state: next, showdownReveal: false });
        runLoop(next);
      }

      function nextHand() {
        const { state, awaitingHumanRebuy } = get();
        if (!state || awaitingHumanRebuy) return;
        // If we're in handover, skip the remaining pause by starting next hand now
        if (state.phase === 'handover') {
          clearPending();
          let afterRebuy = state;
          for (let i = 1; i < afterRebuy.seats.length; i++) {
            const seat = afterRebuy.seats[i];
            if (seat.player.stack <= 0 || seat.sittingOut) {
              afterRebuy = rebuy(afterRebuy, i);
            }
          }
          const next = startHand(afterRebuy);
          set({ state: next, showdownReveal: false });
          runLoop(next);
        }
      }

      return {
        state: null,
        started: false,
        legalActions: null,
        showdownReveal: false,
        awaitingHumanRebuy: false,
        _processing: false,

        start,
        submitHumanAction,
        rebuyHuman,
        nextHand,
      };
    },
    {
      name: 'backroom.v1',
      // Persist only the fields needed to restore a session.
      partialize: (s) => ({
        state: s.state,
        started: s.started,
        showdownReveal: s.showdownReveal,
        awaitingHumanRebuy: s.awaitingHumanRebuy,
      }),
      // On rehydrate, if the game was in-progress resume the loop.
      onRehydrateStorage: () => (restoredState, error) => {
        if (error || !restoredState) return;
        const { state, started, awaitingHumanRebuy } = restoredState;
        if (!started || !state) return;

        // Give React a tick to mount before starting the loop.
        setTimeout(() => {
          const store = useTableStore.getState();

          if (awaitingHumanRebuy) {
            // Hero needs to rebuy — UI will show RebuyDialog, no loop needed yet.
            return;
          }

          if (state.phase === 'handover') {
            // Resume from handover: treat as if pause already elapsed
            store.nextHand?.();
            return;
          }

          if (state.toActIndex === 0) {
            // Hero's turn: restore legalActions
            try {
              const actions = getLegalActions(state);
              useTableStore.setState({ legalActions: actions, _processing: false });
            } catch {
              // State is corrupt — ignore, let user start fresh
            }
            return;
          }

          // Bot's turn or between streets — resume loop
          // We cast to access the internal runLoop via a re-entry trick:
          // Simply call start() would reset everything. Instead we patch state
          // and trigger by calling submitHumanAction indirection.
          // The cleanest approach: replicate loop start here.
          useTableStore.setState({ _processing: false });
          // Trigger loop by calling internal helper indirectly
          const freshState = useTableStore.getState().state;
          if (freshState) {
            // We need to re-run the loop from where we left off.
            // Re-export of runLoop isn't possible from within persist middleware,
            // so we restart as a "hot" resume: nextHand-like but from current state.
            _resumeLoop(freshState);
          }
        }, 0);
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Resume loop helper (needed for rehydration)
// ---------------------------------------------------------------------------

async function _resumeLoop(s: GameState): Promise<void> {
  useTableStore.setState({ _processing: true });

  let current = s;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { phase, toActIndex } = current;

    if (phase === 'handover') {
      let afterRebuy = current;
      for (let i = 1; i < afterRebuy.seats.length; i++) {
        const seat = afterRebuy.seats[i];
        if (seat.player.stack <= 0 || seat.sittingOut) {
          afterRebuy = rebuy(afterRebuy, i);
        }
      }
      const heroSeat = afterRebuy.seats[0];
      const humanBusted = heroSeat.player.stack <= 0 || heroSeat.sittingOut;
      if (humanBusted) {
        useTableStore.setState({ state: afterRebuy, awaitingHumanRebuy: true, _processing: false });
        return;
      }
      await delay(300);
      const next = startHand(afterRebuy);
      useTableStore.setState({ state: next, showdownReveal: false, awaitingHumanRebuy: false });
      current = next;
      continue;
    }

    if (toActIndex === null) {
      if (phase === 'showdown') {
        await delay(streetDelay());
        current = runShowdown(current);
        useTableStore.setState({ state: current });
        continue;
      } else {
        await delay(streetDelay());
        current = dealNextStreet(current);
        useTableStore.setState({ state: current });
        continue;
      }
    }

    if (toActIndex === 0) {
      try {
        const actions = getLegalActions(current);
        useTableStore.setState({ state: current, legalActions: actions, _processing: false });
      } catch {
        useTableStore.setState({ _processing: false });
      }
      return;
    }

    // Bot's turn
    await delay(botDelay());
    const fresh = useTableStore.getState().state;
    if (!fresh || fresh.toActIndex !== toActIndex) {
      useTableStore.setState({ _processing: false });
      return;
    }
    const botAction = chooseAction(current, toActIndex);
    current = applyAction(current, toActIndex, botAction);
    useTableStore.setState({ state: current });
  }
}
