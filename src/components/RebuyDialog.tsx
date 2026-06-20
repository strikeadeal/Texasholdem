/**
 * RebuyDialog — shown when the human player busts and can rebuy.
 * TODO: implement in step 4 (wiring agent).
 */
import React from 'react';

interface RebuyDialogProps {
  rebuyAmount: number;
  onRebuy: () => void;
  onLeave: () => void;
}

export function RebuyDialog({ rebuyAmount, onRebuy, onLeave }: RebuyDialogProps) {
  void rebuyAmount; void onRebuy; void onLeave;
  return <div data-component="RebuyDialog" />;
}
