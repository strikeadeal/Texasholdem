/**
 * Table — composed game view: felt surface with seats arranged around an ellipse.
 *
 * Layout (portrait):
 *   Hero anchored bottom-center (seatIndex 0).
 *   Up to 5 opponents arranged across the upper arc.
 *   Board + Pot centered.
 *   Bets (ChipStacks) between each seat and the pot.
 *   ActionBar at the very bottom.
 *
 * The Table derives everything shown from `state`. Seat positions are
 * computed relative to heroIndex so the human is always at the bottom.
 *
 * Props contract (wiring agent must conform exactly):
 */
import React from 'react';
import type { GameState, LegalActions, Action } from '../engine/types';
import { Seat } from './Seat';
import { Board } from './Board';
import { Pot } from './Pot';
import { ActionBar } from './ActionBar';
import { HandLog } from './HandLog';
import styles from './Table.module.css';

export interface TableProps {
  state: GameState;
  heroIndex: number;          // = 0
  legalActions: LegalActions | null;
  onAction: (action: Action) => void;
  onNextHand?: () => void;
  reducedMotion?: boolean;
}

/** Map seat indices relative to hero so hero is always "seat 0" at bottom. */
function relativeSeats(state: GameState, heroIndex: number) {
  const n = state.seats.length;
  return Array.from({ length: n }, (_, i) => (i + heroIndex) % n);
}

/**
 * Compute (x%, y%) positions for opponents around the upper arc of the table.
 * Hero is fixed at bottom-center. Opponents spread across top.
 *
 * For k opponents (k = n - 1), distribute evenly across angles
 * from ~200° to ~340° (in screen coords, 0° = right, clockwise).
 * Center of table = (50%, 48%).
 */
function opponentPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  // Upper arc: spread from left to right across the top half
  const positions: Array<{ x: number; y: number }> = [];

  // Table is roughly oval; fit opponents to a gentle arc
  // The arc spans left-to-right at the top.
  // For 1: center-top. For 2: left-top, right-top. For 5: spread.
  const arcStartX = 0.08;
  const arcEndX   = 0.92;
  const arcYMin   = 0.04;  // very top
  const arcYMax   = 0.30;  // mid-upper

  if (count === 1) {
    return [{ x: 50, y: arcYMin * 100 + 4 }];
  }

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    // Parabolic arc: y dips in the middle (opponents at top corners sit higher)
    const x = arcStartX + t * (arcEndX - arcStartX);
    // Parabola: y is lowest at t=0.5 (top-center), higher at edges
    const parabola = 4 * t * (1 - t);  // 0 at edges, 1 at center
    const y = arcYMin + (1 - parabola) * (arcYMax - arcYMin);
    positions.push({ x: x * 100, y: y * 100 });
  }
  return positions;
}

export function Table({
  state,
  heroIndex,
  legalActions,
  onAction,
  onNextHand,
  reducedMotion: _reducedMotion,
}: TableProps) {
  void onNextHand;

  const n = state.seats.length;
  const seatOrder = relativeSeats(state, heroIndex);
  const heroSeat  = state.seats[heroIndex];

  // Opponents in display order (relative seat 1..n-1)
  const opponentRelIndices = seatOrder.slice(1);
  const oppPositions = opponentPositions(opponentRelIndices.length);

  const isHeroTurn = state.toActIndex === heroIndex;
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);

  // Check for winners
  const winnerIds = new Set(state.lastResult?.winners.map((w) => w.playerId) ?? []);

  return (
    <div className={styles.tableOuter}>

      {/* ---- Opponent seats along upper arc ---- */}
      <div className={styles.opponentsArc}>
        {opponentRelIndices.map((relIdx, i) => {
          const absoluteIdx = (heroIndex + relIdx) % n;
          const seat = state.seats[absoluteIdx];
          const pos  = oppPositions[i];
          if (!seat || !pos) return null;

          return (
            <div
              key={absoluteIdx}
              className={styles.opponentSlot}
              style={{
                left: `${pos.x}%`,
                top:  `${pos.y}%`,
                transform: 'translate(-50%, 0)',
              }}
            >
              <Seat
                seat={seat}
                seatIndex={absoluteIdx}
                isHero={false}
                isActive={state.toActIndex === absoluteIdx}
                isDealer={state.buttonIndex === absoluteIdx}
                isSmallBlind={
                  state.phase !== 'idle' &&
                  ((state.buttonIndex + 1) % n) === absoluteIdx
                }
                isBigBlind={
                  state.phase !== 'idle' &&
                  ((state.buttonIndex + 2) % n) === absoluteIdx
                }
                isWinner={winnerIds.has(seat.player.id)}
                showHoleCards={
                  state.phase === 'showdown' || state.phase === 'handover'
                }
              />
            </div>
          );
        })}
      </div>

      {/* ---- Center: Board + Pot ---- */}
      <div className={styles.centerZone}>
        {state.phase !== 'idle' && (
          <span className={styles.phaseLabel}>{state.phase}</span>
        )}
        <Pot pots={state.pots} />
        <Board cards={state.board} size="md" />
      </div>

      {/* ---- Hero zone (bottom) ---- */}
      <div className={styles.heroZone}>
        <Seat
          seat={heroSeat}
          seatIndex={heroIndex}
          isHero={true}
          isActive={isHeroTurn}
          isDealer={state.buttonIndex === heroIndex}
          isSmallBlind={
            state.phase !== 'idle' &&
            ((state.buttonIndex + 1) % n) === heroIndex
          }
          isBigBlind={
            state.phase !== 'idle' &&
            ((state.buttonIndex + 2) % n) === heroIndex
          }
          isWinner={winnerIds.has(heroSeat.player.id)}
          showHoleCards={true}
        />
      </div>

      {/* ---- Action bar ---- */}
      <div className={styles.actionBar}>
        {isHeroTurn && legalActions && (
          <ActionBar
            legalActions={legalActions}
            onAction={onAction}
            potSize={totalPot}
          />
        )}
      </div>

      {/* ---- Hand log overlay ---- */}
      {state.log.length > 0 && (
        <div className={styles.handLogOverlay}>
          <HandLog entries={state.log.slice(-6)} />
        </div>
      )}
    </div>
  );
}
