/**
 * ai.ts — AI decision-making for bot players.
 * Each bot has a Personality that biases its action selection.
 */
import type { GameState, Action, SeatState, Personality } from './types';
import { createDeck, shuffle, deal } from './cards';
import { evaluateHand, compareHands } from './evaluator';
import { getLegalActions } from './engine';

// ---------------------------------------------------------------------------
// Bot Roster
// ---------------------------------------------------------------------------

export interface BotProfile {
  name: string;
  personality: Personality;
}

export const BOT_ROSTER: BotProfile[] = [
  { name: 'Sully', personality: 'aggressive' },
  { name: 'Doc', personality: 'tight' },
  { name: 'Marguerite', personality: 'balanced' },
  { name: 'The Greek', personality: 'tight' },
  { name: 'Rosa', personality: 'loose' },
  { name: 'Eddie', personality: 'aggressive' },
];

// ---------------------------------------------------------------------------
// Monte Carlo equity estimation
// ---------------------------------------------------------------------------

/**
 * Estimate hand equity (win probability) via Monte Carlo simulation.
 *
 * @param holeCards   The bot's two hole cards.
 * @param board       Community cards dealt so far (0, 3, 4, or 5).
 * @param opponents   Number of active opponents (default 1 for simplicity).
 * @param iterations  Number of random simulations (default 300 for speed).
 * @returns           Win probability in [0, 1].
 */
export function estimateEquity(
  holeCards: SeatState['holeCards'],
  board: GameState['board'],
  opponents = 1,
  iterations = 300,
): number {
  if (holeCards.length !== 2) return 0.5;

  // Pre-build the set of known cards to exclude from the random deck.
  const knownCards = new Set<string>(
    [...holeCards, ...board].map(cardKey),
  );

  let wins = 0;
  let ties = 0;

  for (let iter = 0; iter < iterations; iter++) {
    // Build remaining deck (excluding known cards).
    const remaining = createDeck().filter((c) => !knownCards.has(cardKey(c)));
    const shuffledRemaining = shuffle(remaining);

    // Deal opponent hole cards.
    const opponentHands: Array<typeof holeCards> = [];
    let deckCursor = shuffledRemaining;
    let valid = true;

    for (let o = 0; o < opponents; o++) {
      if (deckCursor.length < 2) { valid = false; break; }
      const result = deal(deckCursor, 2);
      opponentHands.push(result.dealt);
      deckCursor = result.rest;
    }

    if (!valid) continue;

    // Complete the board.
    const boardNeeded = 5 - board.length;
    if (deckCursor.length < boardNeeded) continue;
    const boardResult = deal(deckCursor, boardNeeded);
    const fullBoard = [...board, ...boardResult.dealt];

    // Evaluate our hand.
    const myHand = evaluateHand([...holeCards, ...fullBoard]);

    // Evaluate opponent hands and find the best one.
    let beatCount = 0;
    let tieCount = 0;
    for (const oppHole of opponentHands) {
      const oppHand = evaluateHand([...oppHole, ...fullBoard]);
      const cmp = compareHands(myHand, oppHand);
      if (cmp > 0) beatCount++;
      else if (cmp === 0) tieCount++;
    }

    if (beatCount === opponents) wins++;
    else if (beatCount + tieCount === opponents) ties++;
  }

  return (wins + ties * 0.5) / iterations;
}

// ---------------------------------------------------------------------------
// AI decision
// ---------------------------------------------------------------------------

/**
 * Choose an action for the bot at `seatIndex`.
 */
export function chooseAction(state: GameState, seatIndex: number): Action {
  const seat = state.seats[seatIndex];
  const personality = seat.player.personality;
  const legal = getLegalActions(state);

  // Count active opponents.
  const opponents = state.seats.filter(
    (s, i) => i !== seatIndex && !s.hasFolded && !s.sittingOut,
  ).length;

  const equity = estimateEquity(seat.holeCards, state.board, Math.max(1, opponents), 250);

  // Pot odds calculation.
  const potTotal = state.pots.reduce((s, p) => s + p.amount, 0)
    + state.seats.reduce((s, seat) => s + seat.committed, 0);
  const callAmt = legal.callAmount;
  const potOdds = callAmt > 0 ? callAmt / (potTotal + callAmt) : 0;

  // Personality-based thresholds.
  const thresholds = getThresholds(personality);

  // Randomization factor (±5-10%).
  const noise = (Math.random() - 0.5) * 0.12;
  const effectiveEquity = equity + noise;

  // Bluff decision (random, biased by personality).
  const isBluffing = Math.random() < thresholds.bluffFreq;

  // --- Decision logic ---

  // If can check — do so at medium-low equity (free look), else consider betting.
  if (legal.canCheck) {
    if (effectiveEquity > thresholds.betThreshold || isBluffing) {
      // Bet for value or bluff.
      return makeBetOrRaise(state, legal, seat, thresholds, potTotal, equity, 'bet');
    }
    return { type: 'check' };
  }

  // There's a bet to face.
  if (effectiveEquity > thresholds.raiseThreshold || (isBluffing && legal.canRaise)) {
    // Raise/re-raise for value or bluff.
    if (legal.canRaise) {
      return makeBetOrRaise(state, legal, seat, thresholds, potTotal, equity, 'raise');
    }
  }

  if (effectiveEquity > potOdds + thresholds.callEdgeRequired) {
    // Call — we have enough equity vs. pot odds.
    if (legal.canCall) return { type: 'call' };
    // All-in call.
    return { type: 'allin' };
  }

  // Fold.
  return { type: 'fold' };
}

interface PersonalityThresholds {
  betThreshold: number;    // equity needed to bet/bluff (check scenario)
  raiseThreshold: number;  // equity needed to raise facing a bet
  callEdgeRequired: number; // equity margin above pot odds to call
  bluffFreq: number;       // probability of a random bluff
  betSizingFrac: number;   // fraction of pot to bet/raise
  allInThreshold: number;  // equity to just shove
}

function getThresholds(personality: Personality): PersonalityThresholds {
  switch (personality) {
    case 'tight':
      return {
        betThreshold: 0.65,
        raiseThreshold: 0.75,
        callEdgeRequired: 0.10,
        bluffFreq: 0.05,
        betSizingFrac: 0.65,
        allInThreshold: 0.88,
      };
    case 'loose':
      return {
        betThreshold: 0.40,
        raiseThreshold: 0.55,
        callEdgeRequired: -0.05,
        bluffFreq: 0.20,
        betSizingFrac: 0.55,
        allInThreshold: 0.80,
      };
    case 'aggressive':
      return {
        betThreshold: 0.45,
        raiseThreshold: 0.55,
        callEdgeRequired: 0.02,
        bluffFreq: 0.18,
        betSizingFrac: 0.80,
        allInThreshold: 0.78,
      };
    case 'balanced':
    default:
      return {
        betThreshold: 0.55,
        raiseThreshold: 0.65,
        callEdgeRequired: 0.05,
        bluffFreq: 0.10,
        betSizingFrac: 0.65,
        allInThreshold: 0.85,
      };
  }
}

function makeBetOrRaise(
  state: GameState,
  legal: ReturnType<typeof getLegalActions>,
  seat: SeatState,
  thresholds: PersonalityThresholds,
  potTotal: number,
  equity: number,
  mode: 'bet' | 'raise',
): Action {
  // All-in if equity is very high or stack-to-pot is small.
  if (equity > thresholds.allInThreshold || legal.maxRaiseTo === legal.minRaiseTo) {
    return { type: 'allin' };
  }

  // Sizing: fraction of pot.
  const sizing = thresholds.betSizingFrac * (1 + (Math.random() - 0.5) * 0.3);
  let targetTotal = seat.committed + Math.max(Math.round(potTotal * sizing), state.config.bigBlind);

  // Clamp to legal range.
  targetTotal = Math.max(targetTotal, legal.minRaiseTo);
  targetTotal = Math.min(targetTotal, legal.maxRaiseTo);

  if (targetTotal >= legal.maxRaiseTo) {
    return { type: 'allin' };
  }

  return { type: mode, amount: targetTotal };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function cardKey(card: { rank: number; suit: string }): string {
  return `${card.rank}:${card.suit}`;
}
