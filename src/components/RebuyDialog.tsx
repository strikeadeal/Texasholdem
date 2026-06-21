/**
 * RebuyDialog — shown when the human busts.
 * Calm, directive copy. No apology.
 *
 * Props: { amount: number; onRebuy: () => void }
 */
import React from 'react';
import styles from './RebuyDialog.module.css';

export interface RebuyDialogProps {
  amount: number;
  onRebuy: () => void;
}

function formatAmount(n: number): string {
  return n.toLocaleString();
}

export function RebuyDialog({ amount, onRebuy }: RebuyDialogProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Rebuy">
      <div className={styles.dialog}>
        <div className={styles.rule} aria-hidden="true" />
        <h2 className={styles.headline}>You're out of chips.</h2>
        <p className={styles.sub}>The table keeps running. Get back in.</p>
        <button
          className={styles.rebuyBtn}
          onClick={onRebuy}
          aria-label={`Rebuy ${formatAmount(amount)}`}
        >
          Rebuy {formatAmount(amount)}
        </button>
      </div>
    </div>
  );
}
