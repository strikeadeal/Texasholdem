/**
 * ActionBar — brass action buttons for the hero's turn.
 * Shows Fold (left), Check/Call (center), Bet/Raise (right).
 * Raise opens RaiseControl panel above.
 */
import React, { useState } from 'react';
import type { LegalActions, Action } from '../engine/types';
import { RaiseControl } from './RaiseControl';
import styles from './ActionBar.module.css';

export interface ActionBarProps {
  legalActions: LegalActions;
  onAction: (action: Action) => void;
  potSize: number;
}

function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function ActionBar({ legalActions, onAction, potSize }: ActionBarProps) {
  const [raiseOpen, setRaiseOpen] = useState(false);

  const {
    canFold, canCheck, canCall, callAmount,
    canBet, canRaise, minRaiseTo, maxRaiseTo,
  } = legalActions;

  function handleFold() {
    setRaiseOpen(false);
    onAction({ type: 'fold' });
  }

  function handleCheckCall() {
    setRaiseOpen(false);
    if (canCheck) {
      onAction({ type: 'check' });
    } else if (canCall) {
      onAction({ type: 'call', amount: callAmount });
    }
  }

  function handleRaiseConfirm(amount: number) {
    setRaiseOpen(false);
    if (canBet) {
      onAction({ type: 'bet', amount });
    } else {
      onAction({ type: 'raise', amount });
    }
  }

  const canRaiseOrBet = canBet || canRaise;

  // Check/Call label
  const callLabel = canCheck
    ? 'Check'
    : canCall
      ? `Call${callAmount >= 1000 ? ` ${formatAmount(callAmount)}` : ''}`
      : 'Call';
  const callSub = (!canCheck && canCall && callAmount > 0 && callAmount < 1000)
    ? String(callAmount)
    : undefined;

  // Bet/Raise label
  const raiseLabel = canBet ? 'Bet' : 'Raise';

  return (
    <div className={styles.bar}>
      {/* Raise panel above */}
      {raiseOpen && canRaiseOrBet && (
        <div className={styles.raisePanel}>
          <RaiseControl
            min={minRaiseTo}
            max={maxRaiseTo}
            potSize={potSize}
            isBet={canBet}
            onConfirm={handleRaiseConfirm}
            onCancel={() => setRaiseOpen(false)}
          />
        </div>
      )}

      {/* Fold */}
      <button
        className={`${styles.btn} ${styles.btnFold}`}
        onClick={handleFold}
        disabled={!canFold}
        aria-label="Fold"
      >
        Fold
      </button>

      {/* Check / Call */}
      <button
        className={`${styles.btn} ${styles.btnCall}`}
        onClick={handleCheckCall}
        disabled={!canCheck && !canCall}
        aria-label={callLabel}
      >
        <span className={styles.btnLabel}>
          <span className={styles.btnMain}>{callLabel}</span>
          {callSub && <span className={styles.btnSub}>{callSub}</span>}
        </span>
      </button>

      {/* Bet / Raise */}
      <button
        className={`${styles.btn} ${styles.btnRaise}`}
        onClick={() => setRaiseOpen((o) => !o)}
        disabled={!canRaiseOrBet}
        aria-label={raiseLabel}
        aria-expanded={raiseOpen}
      >
        {raiseLabel}
      </button>
    </div>
  );
}
