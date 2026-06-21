/**
 * Table — composed game view: felt surface with seats arranged around an ellipse.
 *
 * Layout (portrait):
 *   Hero anchored bottom-center (seatIndex 0).
 *   Up to 5 opponents arranged across the upper arc.
 *   Board + Pot centered.
 *   Bets (ChipStacks) between each seat and the pot.
 *   ActionBar at the very bottom (hidden when not hero's turn; space reserved).
 *   HandLog: slim ticker docked above center zone, behind seats.
 *   ResultStrip: restrained handover result strip above hero area.
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
 * Seats are kept well inside the oval rail so nothing is clipped.
 * The arc spans from ~18% to ~82% horizontally (inward from the curved edges)
 * and from ~8% to ~26% vertically (below the top rail curvature).
 */
function opponentPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  const positions: Array<{ x: number; y: number }> = [];

  // Pull seats inward from the oval edges so they're never clipped.
  // The oval shape is narrowest at the top and bottom, so corner seats
  // must be pushed further down (higher arcYMax) and inward (smaller x range).
  const arcStartX = 0.20;
  const arcEndX   = 0.80;
  const arcYMin   = 0.10;  // center seat position (top-center of arc)
  const arcYMax   = 0.28;  // corner seats pushed lower to stay inside oval

  if (count === 1) {
    return [{ x: 50, y: arcYMin * 100 + 2 }];
  }

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = arcStartX + t * (arcEndX - arcStartX);
    // Parabolic arc: y is lowest (highest on screen) at edges, highest at center
    // Corner seats nudge lower (arcYMax) while middle seat sits at arcYMin
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

  // Recent log lines for ticker — only non-"wins" lines (wins go to result strip)
  const logTicker = state.log.slice(-2).filter(l => !l.toLowerCase().includes('wins'));

  // Result line at handover: find the last "wins" log entry
  const resultLine = state.phase === 'handover' || state.phase === 'showdown'
    ? [...state.log].reverse().find(l => l.toLowerCase().includes('wins'))
    : undefined;

  // Active opponent name for the "thinking" caption
  const activeOpponentSeat = !isHeroTurn && state.toActIndex !== null
    ? state.seats[state.toActIndex]
    : null;
  const thinkingName = activeOpponentSeat?.player.name ?? null;

  return (
    <div className={styles.tableOuter}>

      {/* ---- Hand log: slim ticker in upper-center band, below opponent arc ---- */}
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

      {/* ---- Center: Board + Pot (phase label removed — superfluous accessory) ---- */}
      <div className={styles.centerZone}>
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

      {/* ---- Result strip: handover winner line, clearly below the board ---- */}
      <AnimatePresence>
        {resultLine && (
          <motion.div
            className={styles.resultStrip}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            {resultLine}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- "Thinking" caption when it's an opponent's turn ---- */}
      <AnimatePresence>
        {thinkingName && (
          <motion.div
            className={styles.thinkingCaption}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {thinkingName} is thinking…
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ---- Action bar — space always reserved to prevent layout shift ---- */}
      <div className={styles.actionBar}>
        <AnimatePresence>
          {isHeroTurn && legalActions ? (
            <motion.div
              key="actionbar-active"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <ActionBar
                legalActions={legalActions}
                onAction={onAction}
                potSize={totalPot}
              />
            </motion.div>
          ) : (
            /* Reserve space so the hero zone doesn't shift when actions appear */
            <div key="actionbar-placeholder" className={styles.actionBarPlaceholder} />
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
