/**
 * Table — the felt playing surface.
 * TODO: seat positions, board, pots rendered here in later steps.
 */
import React from 'react';
import styles from './Table.module.css';

interface TableProps {
  children?: React.ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div className={styles.table}>
      {children}
    </div>
  );
}
