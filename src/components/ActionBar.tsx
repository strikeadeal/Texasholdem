/**
 * ActionBar — fold / check / call / raise controls for the human player.
 * TODO: implement in step 4 (wiring agent).
 */
import React from 'react';
import type { LegalActions, Action } from '../engine/types';

interface ActionBarProps {
  legalActions: LegalActions;
  onAction: (action: Action) => void;
}

export function ActionBar({ legalActions, onAction }: ActionBarProps) {
  void legalActions; void onAction;
  return <div data-component="ActionBar" />;
}
