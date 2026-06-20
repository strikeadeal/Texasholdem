/**
 * Board — renders 5 community card slots.
 * Dealt cards show face-up; empty slots show as faint inset rectangles.
 */
import React from 'react';
import type { Card as CardType } from '../engine/types';
import { Card } from './Card';
import styles from './Board.module.css';

interface BoardProps {
  cards: CardType[];
  size?: 'sm' | 'md' | 'lg';
}

export function Board({ cards, size = 'md' }: BoardProps) {
  const slots = 5;

  return (
    <div className={styles.board} role="group" aria-label="Community cards">
      {Array.from({ length: slots }, (_, i) => {
        const card = cards[i];
        if (card) {
          return (
            <Card
              key={i}
              card={card}
              faceDown={false}
              size={size}
              dealtDelayIndex={i}
            />
          );
        }
        return (
          <div
            key={i}
            className={`${styles.emptySlot} ${styles[size] ?? ''}`}
            role="img"
            aria-label="Empty card slot"
          />
        );
      })}
    </div>
  );
}
