/**
 * Seat — engraved brass nameplate with hole cards, markers, and timer ring.
 *
 * The active-seat brass timer ring sweeps around the nameplate area.
 * Hero seat shows cards larger and lifted. Folded seats dim/desaturate.
 */
import React from 'react';
import type { SeatState } from '../engine/types';
import { Card } from './Card';
import { ChipStack } from './ChipStack';
import { DealerButton } from './DealerButton';
import type { MarkerType } from './DealerButton';
import styles from './Seat.module.css';

export interface SeatProps {
  seat: SeatState;
  seatIndex: number;
  isHero: boolean;
  isActive: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isWinner: boolean;
  showHoleCards: boolean;
}

/**
 * Brass timer ring rendered as an SVG rect stroke with dasharray animation.
 * We draw a rounded-rect perimeter and animate stroke-dashoffset.
 */
function TimerRing({ width, height }: { width: number; height: number }) {
  // Perimeter of a rounded rect (approx)
  const r = 6;
  const perimeter = 2 * (width + height) - 8 * r + 2 * Math.PI * r;

  return (
    <div className={styles.timerRing} aria-hidden="true">
      <svg
        className={styles.timerRingSvg}
        viewBox={`-6 -6 ${width + 12} ${height + 12}`}
        overflow="visible"
      >
        <rect
          x="-4"
          y="-4"
          width={width + 8}
          height={height + 8}
          rx={r}
          ry={r}
          fill="none"
          stroke="rgba(184,145,84,0.18)"
          strokeWidth="1.5"
        />
        <rect
          className={styles.timerArc}
          x="-4"
          y="-4"
          width={width + 8}
          height={height + 8}
          rx={r}
          ry={r}
          strokeDasharray={`${perimeter} ${perimeter}`}
          strokeDashoffset="0"
          style={{
            animationDuration: '30s',
          }}
        />
      </svg>
    </div>
  );
}

function formatStack(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function Seat({
  seat,
  seatIndex,
  isHero,
  isActive,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isWinner,
  showHoleCards,
}: SeatProps) {
  void seatIndex;

  const cardSize = isHero ? 'md' : 'sm';

  const markers: MarkerType[] = [];
  if (isDealer)     markers.push('D');
  if (isSmallBlind) markers.push('SB');
  if (isBigBlind)   markers.push('BB');

  const seatClasses = [
    styles.seat,
    isHero      ? styles.hero      : '',
    isActive    ? styles.active    : '',
    seat.hasFolded  ? styles.folded    : '',
    seat.isAllIn    ? styles.allIn     : '',
    seat.sittingOut ? styles.sittingOut: '',
    isWinner    ? styles.winner    : '',
  ].filter(Boolean).join(' ');

  // Approximate nameplate dimensions for the timer ring
  const nameplateW = isHero ? 80 : 52;
  const nameplateH = isHero ? 30 : 26;

  return (
    <div className={seatClasses}>
      {/* Timer ring sits behind the nameplate */}
      {isActive && <TimerRing width={nameplateW} height={nameplateH} />}

      {/* All-in tag */}
      {seat.isAllIn && (
        <div className={styles.allInTag}>ALL IN</div>
      )}

      {/* Nameplate */}
      <div className={styles.nameplate} style={{ width: nameplateW }}>
        <span className={styles.name}>{seat.player.name}</span>
        <span className={styles.stack}>{formatStack(seat.player.stack)}</span>
      </div>

      {/* Dealer / blind markers */}
      {markers.length > 0 && (
        <div className={styles.markers}>
          {markers.map((m) => (
            <DealerButton key={m} type={m} />
          ))}
        </div>
      )}

      {/* Bet amount */}
      {seat.committed > 0 && (
        <div className={styles.betArea}>
          <ChipStack amount={seat.committed} maxChips={3} />
        </div>
      )}

      {/* Hole cards */}
      {seat.holeCards.length > 0 && (
        <div className={`${styles.holeCards} ${isHero ? styles.heroCards : ''}`}>
          {seat.holeCards.map((card, i) => (
            <Card
              key={i}
              card={card}
              faceDown={!showHoleCards && !isHero}
              size={cardSize}
              dealtDelayIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
