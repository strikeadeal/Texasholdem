/**
 * App — root shell for "The Back Room".
 *
 * Renders a full-viewport, portrait-locked layout:
 *   backdrop → brass rail → mahogany band → felt table surface
 *
 * Safe-area insets are respected via env(safe-area-inset-*).
 * This is the one visible deliverable for step 1; game components
 * are mounted here in later steps.
 */
import React from 'react';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.viewport}>
      {/* Outer brass rail frame */}
      <div className={styles.railOuter}>
        <div className={styles.railInner}>
          {/* Felt table surface */}
          <div className={styles.felt}>
            {/* Step 1 placeholder: title centered on the felt */}
            <div className={styles.titleBlock}>
              <span className={styles.titleEyebrow}>Private Table</span>
              <h1 className={styles.title}>The Back Room</h1>
              <span className={styles.titleSub}>Texas Hold'em</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
