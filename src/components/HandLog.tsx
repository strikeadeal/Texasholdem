/**
 * HandLog — compact, scrollable log of recent hand events.
 * Faint ivory text on felt; glanceable, not dominant.
 */
import React, { useRef, useEffect } from 'react';
import styles from './HandLog.module.css';

export interface HandLogProps {
  entries: string[];
}

export function HandLog({ entries }: HandLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className={styles.log} aria-live="polite" aria-label="Hand log">
      {entries.map((entry, i) => (
        <div key={i} className={styles.entry}>
          {entry}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
