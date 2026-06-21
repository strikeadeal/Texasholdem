/**
 * App — root shell for "The Back Room".
 *
 * Routes between:
 *   1. FirstRun (not yet started)
 *   2. RebuyDialog overlay (human busted at handover)
 *   3. Live Table (game in progress)
 *
 * Layout: --backdrop → brass rail outer → mahogany band → felt + Table.
 * Safe-area insets are respected via env(safe-area-inset-*).
 */
import React from 'react';
import { Table } from './components/Table';
import { FirstRun } from './components/FirstRun';
import { RebuyDialog } from './components/RebuyDialog';
import { useTableStore } from './store/table';
import { useReducedMotion } from './hooks/useReducedMotion';
import styles from './App.module.css';

export default function App() {
  const {
    state,
    started,
    legalActions,
    awaitingHumanRebuy,
    start,
    submitHumanAction,
    rebuyHuman,
    nextHand,
  } = useTableStore();

  const reducedMotion = useReducedMotion();

  // ---- Not started yet ----
  if (!started || !state) {
    return (
      <div className={styles.viewport}>
        <div className={styles.railOuter}>
          <div className={styles.railInner}>
            <FirstRun onStart={start} />
          </div>
        </div>
      </div>
    );
  }

  const rebuyAmount = state.config.rebuyAmount;

  return (
    <div className={styles.viewport}>
      {/* Outer brass ring */}
      <div className={styles.railOuter}>
        {/* Inner mahogany band */}
        <div className={styles.railInner}>
          {/* Felt table surface — Table fills it */}
          <Table
            state={state}
            heroIndex={0}
            legalActions={legalActions}
            onAction={submitHumanAction}
            onNextHand={nextHand}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>

      {/* Rebuy dialog overlays everything when hero is busted */}
      {awaitingHumanRebuy && (
        <RebuyDialog
          amount={rebuyAmount}
          onRebuy={rebuyHuman}
        />
      )}
    </div>
  );
}
