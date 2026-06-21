/**
 * BrassRail — the signature beveled brass + mahogany frame.
 * Wraps the felt play surface. Respects iOS safe areas.
 */
import React from 'react';
import styles from './BrassRail.module.css';

interface BrassRailProps {
  children: React.ReactNode;
}

export function BrassRail({ children }: BrassRailProps) {
  return (
    <div className={styles.rail}>
      <div className={styles.inner}>
        {children}
      </div>
    </div>
  );
}
