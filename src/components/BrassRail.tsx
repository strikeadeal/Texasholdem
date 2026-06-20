/**
 * BrassRail — the beveled brass + mahogany frame that wraps the felt table.
 * Visual implementation is in App.tsx for the scaffold; this component will
 * receive layout / animation responsibility in later steps.
 */
import React from 'react';
import styles from './BrassRail.module.css';

interface BrassRailProps {
  children: React.ReactNode;
}

export function BrassRail({ children }: BrassRailProps) {
  return (
    <div className={styles.rail}>
      {children}
    </div>
  );
}
