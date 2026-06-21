/**
 * Pot — displays the main pot (and any side pots) on an engraved brass plate.
 */
import React from 'react';
import type { Pot as PotType } from '../engine/types';
import { ChipStack } from './ChipStack';
import styles from './Pot.module.css';

interface PotProps {
  pots: PotType[];
}

function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function Pot({ pots }: PotProps) {
  if (!pots || pots.length === 0) return null;

  const mainPot = pots[0];
  const sidePots = pots.slice(1);
  const mainTotal = mainPot.amount;

  return (
    <div className={styles.potWrapper}>
      <ChipStack amount={mainTotal} maxChips={5} />

      {/* Main pot brass plate */}
      <div className={styles.plate}>
        <span className={styles.label}>Pot</span>
        <span className={styles.amount}>{formatAmount(mainTotal)}</span>
      </div>

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className={styles.sidePots}>
          {sidePots.map((pot, i) => (
            <div key={i} className={styles.sidePot}>
              <span className={styles.sidePotLabel}>Side {i + 1}</span>
              <span className={styles.sidePotAmount}>{formatAmount(pot.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
