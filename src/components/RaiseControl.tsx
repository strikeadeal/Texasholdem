/**
 * RaiseControl — felt panel: slider + quick-chip buttons for sizing a bet/raise.
 * Quick chips: Min, ½ Pot, Pot, All in.
 * Confirm button reads "Raise to N" or "Bet N".
 */
import React, { useState, useCallback } from 'react';
import styles from './RaiseControl.module.css';

export interface RaiseControlProps {
  min: number;
  max: number;
  potSize: number;
  isBet?: boolean;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function RaiseControl({
  min,
  max,
  potSize,
  isBet = false,
  onConfirm,
  onCancel: _onCancel,
}: RaiseControlProps) {
  const safeMin = Math.min(min, max);
  const safeMax = max;

  const [value, setValue] = useState<number>(safeMin);

  const pct = safeMax > safeMin
    ? ((value - safeMin) / (safeMax - safeMin)) * 100
    : 0;

  const set = useCallback(
    (v: number) => setValue(clamp(Math.round(v), safeMin, safeMax)),
    [safeMin, safeMax],
  );

  const quickOptions = [
    { label: 'Min',    amount: safeMin },
    { label: '½ Pot',  amount: Math.round(potSize / 2) },
    { label: 'Pot',    amount: potSize },
    { label: 'All in', amount: safeMax },
  ];

  const confirmLabel = isBet
    ? `Bet ${formatAmount(value)}`
    : `Raise to ${formatAmount(value)}`;

  return (
    <div className={styles.panel} role="dialog" aria-label="Size your raise">
      {/* Slider row */}
      <div className={styles.sliderRow}>
        <input
          type="range"
          className={styles.slider}
          min={safeMin}
          max={safeMax}
          step={1}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
          aria-label="Raise amount"
          aria-valuemin={safeMin}
          aria-valuemax={safeMax}
          aria-valuenow={value}
        />
        <span className={styles.amountDisplay}>{formatAmount(value)}</span>
      </div>

      {/* Quick-chip buttons */}
      <div className={styles.quickRow}>
        {quickOptions.map(({ label, amount }) => (
          <button
            key={label}
            className={styles.quickBtn}
            onClick={() => set(amount)}
            aria-label={`Set to ${label}: ${formatAmount(amount)}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Confirm */}
      <button
        className={styles.confirmBtn}
        onClick={() => onConfirm(value)}
        aria-label={confirmLabel}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
