/**
 * HandLog — scrollable log of hand events.
 * TODO: implement in step 4 (wiring agent).
 */
import React from 'react';

interface HandLogProps {
  entries: string[];
}

export function HandLog({ entries }: HandLogProps) {
  void entries;
  return <div data-component="HandLog" />;
}
