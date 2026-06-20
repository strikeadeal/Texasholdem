/**
 * Board — renders the five community card slots.
 * TODO: implement in step 3 (visual components agent).
 */
import React from 'react';
import type { Card as CardType } from '../engine/types';

interface BoardProps {
  cards: CardType[];
}

export function Board({ cards }: BoardProps) {
  void cards;
  return <div data-component="Board" />;
}
