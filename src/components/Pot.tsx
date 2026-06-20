/**
 * Pot — renders the pot amount in the center of the table.
 * TODO: implement in step 3 (visual components agent).
 */
import React from 'react';
import type { Pot as PotType } from '../engine/types';

interface PotProps {
  pots: PotType[];
}

export function Pot({ pots }: PotProps) {
  void pots;
  return <div data-component="Pot" />;
}
