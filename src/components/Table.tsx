/**
 * Table — composed game view: felt surface with seats arranged around an ellipse.
 *
 * Layout (portrait):
 *   Hero anchored bottom-center (seatIndex 0).
 *   Up to 5 opponents arranged across the upper arc.
 *   Board + Pot centered.
 *   Bets (ChipStacks) between each seat and the pot.
 *   ActionBar at the very bottom.
 *   HandLog: slim ticker docked top-center, BELOW the rail, z-index behind seats.
 *
 * The Table derives everything shown from `state`. Seat positions are
 * computed relative to heroIndex so the human is always at the bottom.
 *
 * Props contract (wiring agent must conform exactly):
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const positions: Array<{ x: number; y: number }> = [];

  // Tighter arc with more spacing to avoid overlap
  const arcStartX = 0.10;
  const arcEndX   = 0.90;
  const arcYMin   = 0.06;  // very top
  const arcYMax   = 0.28;  // mid-upper

  if (count === 1) {
    return [{ x: 50, y: arcYMin * 100 + 2 }];
  }

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = arcStartX + t * (arcEndX - arcStartX);
    // Parabolic arc: y is lowest (highest on screen) at edges, highest in middle
    // This puts corner seats at top and middle seat at mid-upper
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
  reducedMotion = false,
}: TableProps) {
  const n = state.seats.length;
  const seatOrder = relativeSeats(state, heroIndex);
  const heroSeat  = state.seats[heroIndex];

  // Opponents in display order (relative seat 1..n-1)
  const opponentRelIndices = seatOrder.slice(1);
  const oppPositions = opponentPositions(opponentRelIndices.length);

  const isHeroTurn = state.toActIndex === heroIndex;
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0)
    + state.seats.reduce((s, seat) => s + seat.committed, 0);
  const committedPot = state.pots.reduce((s, p) => s + p.amount, 0);

  // Check for winners
  const winnerIds = new Set(state.lastResult?.winners.map((w) => w.playerId) ?? []);

  // Show showdown cards (opponents' hole cards face-up) in showdown/handover
  const showOpponentCards = state.phase === 'showdown' || state.phase === 'handover';

  // Recent log lines for ticker (bottom 3 lines)
  const logTicker = state.log.slice(-3);

  return (
    <div className={styles.tableOuter}>

      {/* ---- Hand log: slim ticker top-center, z-index 1 (behind seats) ---- */}
      {logTicker.length > 0 && (
        <div className={styles.handLogTicker}>
          <HandLog entries={logTicker} />
        </div>
      )}

      {/* ---- Opponent seats along upper arc ---- */}
      <div className={styles.opponentsArc}>
        <AnimatePresence>
          {opponentRelIndices.map((relIdx, i) => {
            const absoluteIdx = (heroIndex + relIdx) % n;
            const seat = state.seats[absoluteIdx];
            const pos  = oppPositions[i];
            if (!seat || !pos) return null;

            return (
              <motion.div
                key={absoluteIdx}
                className={styles.opponentSlot}
                style={{
                  left: `${pos.x}%`,
                  top:  `${pos.y}%`,
                  transform: 'translate(-50%, 0)',
                }}
                initial={reducedMotion ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 }}
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
                  showHoleCards={showOpponentCards}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ---- Center: Board + Pot ---- */}
      <div className={styles.centerZone}>
        {state.phase !== 'idle' && (
          <span className={styles.phaseLabel}>{state.phase}</span>
        )}
        {/* Pot: only show the committed pot (pots array), not total with bets */}
        {committedPot > 0 && (
          <motion.div
            key={committedPot}
            initial={reducedMotion ? false : { scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <Pot pots={state.pots} />
          </motion.div>
        )}
        <motion.div
          layout={!reducedMotion}
          className={styles.boardWrapper}
        >
          <Board cards={state.board} size="md" />
        </motion.div>
      </div>

      {/* ---- Hero zone (bottom) ---- */}
      <div className={styles.heroZone}>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
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
        </motion.div>
      </div>

      {/* ---- Action bar ---- */}
      <div className={styles.actionBar}>
        <AnimatePresence>
          {isHeroTurn && legalActions && (
            <motion.div
              key="actionbar"
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2 }}
            >
              <ActionBar
                legalActions={legalActions}
                onAction={onAction}
                potSize={totalPot}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Next hand button at handover (when not hero's turn) */}
      {state.phase === 'handover' && onNextHand && (
        <div className={styles.nextHandBar}>
          <motion.button
            className={styles.nextHandBtn}
            onClick={onNextHand}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Next Hand
          </motion.button>
        </div>
      )}
    </div>
  );
}
