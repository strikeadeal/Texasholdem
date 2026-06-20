/**
 * Card — renders a single playing card (face-up or face-down).
 * TODO: implement in step 3 (visual components agent).
 */
import React from 'react';
import type { Card as CardType } from '../engine/types';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
}

export function Card({ card, faceDown }: CardProps) {
  void card; void faceDown;
  return <div data-component="Card" />;
}
