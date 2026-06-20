/**
 * App — root shell for "The Back Room".
 *
 * Renders the full Table with mock state for visual QA.
 * The wiring agent will swap mockState for the live store.
 *
 * Layout: --backdrop → brass rail outer → mahogany band → felt + Table.
 * Safe-area insets are respected via env(safe-area-inset-*).
 */
import React from 'react';
import { Table } from './components/Table';
import { mockState, mockLegalActions } from './components/__mock__/mockState';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.viewport}>
      {/* Outer brass ring */}
      <div className={styles.railOuter}>
        {/* Inner mahogany band */}
        <div className={styles.railInner}>
          {/* Felt table surface — Table fills it */}
          <Table
            state={mockState}
            heroIndex={0}
            legalActions={mockLegalActions}
            onAction={(action) => {
              // eslint-disable-next-line no-console
              console.log('[mock] action:', action);
            }}
          />
        </div>
      </div>
    </div>
  );
}
