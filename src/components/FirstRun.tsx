/**
 * FirstRun — first-launch screen.
 * "Pull up a chair." on felt with a brass Deal me in button.
 *
 * Props: { onStart: () => void }
 * (The wiring agent may extend onStart with config params if needed.)
 */
import React from 'react';
import styles from './FirstRun.module.css';

export interface FirstRunProps {
  onStart: () => void;
}

export function FirstRun({ onStart }: FirstRunProps) {
  return (
    <div className={styles.screen}>
      <span className={styles.eyebrow}>Private Table · Texas Hold'em</span>
      <h1 className={styles.headline}>Pull up a chair.</h1>
      <p className={styles.sub}>Six-handed no-limit. No rake. No nonsense.</p>
      <button
        className={styles.dealBtn}
        onClick={onStart}
        aria-label="Deal me in"
      >
        Deal me in
      </button>
    </div>
  );
}
