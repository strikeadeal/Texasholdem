/**
 * Seat — renders a player seat around the table.
 * TODO: implement in step 3 (visual components agent).
 */
import React from 'react';
import type { SeatState } from '../engine/types';

interface SeatProps {
  seat: SeatState;
  seatIndex: number;
  isActive: boolean;
  isDealer: boolean;
}

export function Seat({ seat, seatIndex, isActive, isDealer }: SeatProps) {
  void seat; void seatIndex; void isActive; void isDealer;
  return <div data-component="Seat" />;
}
