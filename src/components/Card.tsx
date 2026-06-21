/**
 * Card — an aged-ivory playing card with paper grain and typographic indices.
 * Face-up: ivory stock, corner rank+suit, large center pip or letter monogram.
 * Face-down: deep felt-green with burnished-gold guilloche SVG back.
 *
 * Markup wraps in a flip-container so a CSS 3-D flip is feasible in step 4.
 */
import React from 'react';
import type { Card as CardType, Suit } from '../engine/types';
import styles from './Card.module.css';

export interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  dealtDelayIndex?: number;
}

/* ---- Rank labels ---- */
function rankLabel(rank: number): string {
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return String(rank);
}

/* ---- Suit glyphs (Unicode) ---- */
const SUIT_GLYPH: Record<Suit, string> = {
  spades:   '♠',
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣',
};

function suitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? styles.red : styles.black;
}

/* ---- Guilloche back pattern (SVG) ---- */
function GuillocheBack({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 36 : size === 'md' ? 52 : 72;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${s} ${s}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`g-${size}`} width={s / 4} height={s / 4} patternUnits="userSpaceOnUse">
          <circle
            cx={s / 8}
            cy={s / 8}
            r={s / 8 - 1}
            fill="none"
            stroke="#B89154"
            strokeWidth="0.6"
            opacity="0.6"
          />
          <circle
            cx={s / 8}
            cy={s / 8}
            r={s / 8 - 3}
            fill="none"
            stroke="#E6C77E"
            strokeWidth="0.4"
            opacity="0.35"
          />
        </pattern>
        {/* Diamond lattice overlay */}
        <pattern id={`d-${size}`} width={s / 6} height={s / 6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2={s / 6} y2="0" stroke="#B89154" strokeWidth="0.4" opacity="0.3" />
          <line x1="0" y1="0" x2="0" y2={s / 6} stroke="#B89154" strokeWidth="0.4" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#g-${size})`} />
      <rect width="100%" height="100%" fill={`url(#d-${size})`} />
      {/* Center diamond badge */}
      <polygon
        points={`${s / 2},${s / 4} ${s * 3 / 4},${s / 2} ${s / 2},${s * 3 / 4} ${s / 4},${s / 2}`}
        fill="none"
        stroke="#E6C77E"
        strokeWidth="0.7"
        opacity="0.5"
      />
    </svg>
  );
}

/* ---- Filigree ornament for J/Q/K ---- */
function FiligreeSVG({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const r = size === 'sm' ? 10 : size === 'md' ? 15 : 20;
  return (
    <svg
      width={r * 4}
      height={r * 4}
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="30" cy="30" r="28" fill="none" stroke="#B89154" strokeWidth="1" />
      <circle cx="30" cy="30" r="22" fill="none" stroke="#B89154" strokeWidth="0.6" />
      <circle cx="30" cy="30" r="16" fill="none" stroke="#E6C77E" strokeWidth="0.8" />
      {/* Petal spokes */}
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={angle}
          x1="30" y1="30"
          x2={30 + 26 * Math.cos((angle * Math.PI) / 180)}
          y2={30 + 26 * Math.sin((angle * Math.PI) / 180)}
          stroke="#B89154"
          strokeWidth="0.5"
        />
      ))}
      {[22.5, 67.5, 112.5, 157.5].map((angle) => (
        <line
          key={angle}
          x1="30" y1="30"
          x2={30 + 26 * Math.cos((angle * Math.PI) / 180)}
          y2={30 + 26 * Math.sin((angle * Math.PI) / 180)}
          stroke="#B89154"
          strokeWidth="0.3"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

export function Card({ card, faceDown = false, size = 'md', dealtDelayIndex }: CardProps) {
  const isFaceDown = faceDown || !card;
  const sizeClass = styles[size];

  const delayStyle: React.CSSProperties = dealtDelayIndex != null
    ? { animationDelay: `${dealtDelayIndex * 80}ms`, transitionDelay: `${dealtDelayIndex * 40}ms` }
    : {};

  return (
    <div
      className={`${styles.flipContainer} ${sizeClass} ${isFaceDown ? styles.faceDown : ''}`}
      style={delayStyle}
      role="img"
      aria-label={
        isFaceDown
          ? 'Card (face down)'
          : card
            ? `${rankLabel(card.rank)} of ${card.suit}`
            : 'Empty card slot'
      }
    >
      <div className={styles.card}>
        {/* ---- Face-up side ---- */}
        <div className={`${styles.face} ${sizeClass}`}>
          {card && !isFaceDown && (
            <>
              {/* Top-left corner index */}
              <div className={`${styles.cornerTL} ${sizeClass}`}>
                <span className={`${styles.cornerRank} ${suitColor(card.suit)}`}>
                  {rankLabel(card.rank)}
                </span>
                <span className={`${styles.cornerSuit} ${suitColor(card.suit)}`}>
                  {SUIT_GLYPH[card.suit]}
                </span>
              </div>

              {/* Center: pip or monogram */}
              <div className={styles.center}>
                {card.rank >= 11 ? (
                  /* Face card: filigree + letter monogram + suit pip */
                  <div className={styles.monogram}>
                    <div className={styles.filigree}>
                      <FiligreeSVG size={size} />
                    </div>
                    <span className={`${styles.monogramLetter} ${suitColor(card.suit)}`}>
                      {rankLabel(card.rank)}
                    </span>
                    <span className={`${styles.monogramSuit} ${suitColor(card.suit)}`}>
                      {SUIT_GLYPH[card.suit]}
                    </span>
                  </div>
                ) : (
                  /* Numeric card: large center suit pip */
                  <span className={`${styles.centerPip} ${suitColor(card.suit)}`}>
                    {SUIT_GLYPH[card.suit]}
                  </span>
                )}
              </div>

              {/* Bottom-right corner index (rotated 180°) */}
              <div className={`${styles.cornerBR} ${sizeClass}`}>
                <span className={`${styles.cornerRank} ${suitColor(card.suit)}`}>
                  {rankLabel(card.rank)}
                </span>
                <span className={`${styles.cornerSuit} ${suitColor(card.suit)}`}>
                  {SUIT_GLYPH[card.suit]}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ---- Face-down back ---- */}
        <div className={styles.back}>
          <div className={styles.backPattern}>
            <GuillocheBack size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}
