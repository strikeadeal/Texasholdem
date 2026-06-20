/**
 * FirstRun — onboarding dialog shown when no game has been started.
 * Lets the player configure their name and table stakes.
 * TODO: implement in step 4 (wiring agent).
 */
import React from 'react';
import type { GameConfig } from '../engine/types';

interface FirstRunProps {
  onStart: (playerName: string, config: GameConfig) => void;
}

export function FirstRun({ onStart }: FirstRunProps) {
  void onStart;
  return <div data-component="FirstRun" />;
}
