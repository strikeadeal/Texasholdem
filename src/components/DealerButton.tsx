/**
 * DealerButton — a small brass disc engraved with "D", "SB", or "BB".
 */
import React from 'react';
import styles from './DealerButton.module.css';

export type MarkerType = 'D' | 'SB' | 'BB';

export interface DealerButtonProps {
  type?: MarkerType;
}

export function DealerButton({ type = 'D' }: DealerButtonProps) {
  const isDealer = type === 'D';
  return (
    <div
      className={`${styles.disc} ${isDealer ? styles.dealer : styles.blind}`}
      role="img"
      aria-label={
        type === 'D' ? 'Dealer button' :
        type === 'SB' ? 'Small blind' : 'Big blind'
      }
    >
      <span className={styles.text}>{type}</span>
    </div>
  );
}
