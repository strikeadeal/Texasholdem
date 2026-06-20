/**
 * engine.ts — pure state-transition functions for Texas Hold'em.
 * All functions are pure: (GameState, ...) => GameState.
 * The human player is always seat index 0.
 */
import type {
  GameState,
  GameConfig,
  Action,
  LegalActions,
  HandResult,
  Player,
  SeatState,
  Pot,
  PotDistribution,
} from './types';
import { createDeck, shuffle, deal } from './cards';
import { evaluateHand, compareHands } from './evaluator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Index of the next seat (wrapping), optionally skipping a predicate. */
function nextSeatIndex(
  seats: SeatState[],
  from: number,
  skip: (s: SeatState) => boolean,
): number | null {
  const n = seats.length;
  for (let i = 1; i < n; i++) {
    const idx = (from + i) % n;
    if (!skip(seats[idx])) return idx;
  }
  return null;
}

/** All active seats (not folded, not sitting out). */
function activeSeatIndices(seats: SeatState[]): number[] {
  return seats.map((s, i) => ({ s, i })).filter(({ s }) => !s.hasFolded && !s.sittingOut).map(({ i }) => i);
}

/** Active seats that can still act (not folded, not sitting out, not all-in). */
function actionableSeatIndices(seats: SeatState[]): number[] {
  return seats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.hasFolded && !s.sittingOut && !s.isAllIn)
    .map(({ i }) => i);
}

/** Seats dealt into the hand (not sitting out). */
function dealtSeatIndices(seats: SeatState[]): number[] {
  return seats.map((s, i) => ({ s, i })).filter(({ s }) => !s.sittingOut).map(({ i }) => i);
}

/**
 * Check whether the current betting round is complete:
 * - Fewer than 2 players can still act, OR
 * - Every player who can act has acted this round and is matched to currentBet.
 */
function isBettingRoundComplete(state: GameState): boolean {
  const actionable = actionableSeatIndices(state.seats);
  if (actionable.length < 2) return true;

  return actionable.every((i) => {
    const seat = state.seats[i];
    return seat.hasActedThisRound && seat.committed === state.currentBet;
  });
}

/** Find the first seat to act post-flop: left of button among actionable seats. */
function firstToActPostFlop(state: GameState): number | null {
  const actionable = new Set(actionableSeatIndices(state.seats));
  if (actionable.size === 0) return null;
  const n = state.seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.buttonIndex + i) % n;
    if (actionable.has(idx)) return idx;
  }
  return null;
}

/** Build side pots from totalCommitted values. */
function buildSidePots(state: GameState): Pot[] {
  const dealt = dealtSeatIndices(state.seats);
  const nonFolded = dealt.filter((i) => !state.seats[i].hasFolded);

  if (nonFolded.length === 0) return [];

  // Collect all distinct totalCommitted thresholds, sorted ascending.
  const levels = [
    ...new Set(dealt.map((i) => state.seats[i].totalCommitted).filter((v) => v > 0)),
  ].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let prev = 0;

  for (const level of levels) {
    const chipPerPlayer = level - prev;
    let potAmount = 0;

    for (const i of dealt) {
      const contributed = Math.min(state.seats[i].totalCommitted, level) - prev;
      if (contributed > 0) potAmount += contributed;
    }

    if (potAmount <= 0) {
      prev = level;
      continue;
    }

    // Eligible: non-folded players who contributed at least up to this level.
    const eligible = nonFolded
      .filter((i) => state.seats[i].totalCommitted >= level)
      .map((i) => state.seats[i].player.id);

    // Also include players who are NOT all-in but matched up to this level.
    // (Already covered above: all non-folded whose totalCommitted >= level.)

    if (eligible.length > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    } else {
      // Degenerate: no eligible players for this slice — return chips to contributors.
      // This shouldn't happen in normal play.
    }

    prev = level;
    chipPerPlayer; // suppress unused warning
  }

  // Merge consecutive pots with identical eligible sets.
  const merged: Pot[] = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && arraysEqual(last.eligiblePlayerIds, pot.eligiblePlayerIds)) {
      last.amount += pot.amount;
    } else {
      merged.push({ ...pot, eligiblePlayerIds: [...pot.eligiblePlayerIds] });
    }
  }

  return merged;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Get a display name for a seat ("You" for human, else player name). */
function seatName(seat: SeatState): string {
  return seat.player.isHuman ? 'You' : seat.player.name;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the initial GameState for a new table.
 * @param config  Blind / stack configuration.
 * @param players Ordered array of players; index 0 must be the human.
 */
export function createTable(config: GameConfig, players: Player[]): GameState {
  if (players.length < 2) throw new Error('Need at least 2 players');
  const seats: SeatState[] = players.map((p) => ({
    player: { ...p },
    holeCards: [],
    committed: 0,
    totalCommitted: 0,
    hasFolded: false,
    isAllIn: false,
    hasActedThisRound: false,
    sittingOut: false,
  }));

  return {
    config,
    seats,
    buttonIndex: 0, // Will be properly set on first startHand.
    phase: 'idle',
    board: [],
    deck: [],
    pots: [],
    currentBet: 0,
    minRaise: config.bigBlind,
    toActIndex: null,
    lastAggressorIndex: null,
    handNumber: 0,
    log: [],
    lastResult: null,
  };
}

/**
 * Start a new hand: rotate button, post blinds, deal hole cards, advance to preflop.
 */
export function startHand(state: GameState): GameState {
  let s = cloneState(state);

  // Mark busted seats as sitting out.
  for (const seat of s.seats) {
    if (seat.player.stack <= 0) {
      seat.sittingOut = true;
    }
  }

  // Determine active players (eligible for the button and action).
  const eligibleIndices = s.seats
    .map((seat, i) => ({ seat, i }))
    .filter(({ seat }) => !seat.sittingOut)
    .map(({ i }) => i);

  if (eligibleIndices.length < 2) {
    throw new Error('Need at least 2 active players to start a hand');
  }

  // Rotate button (or pick initial button if handNumber === 0).
  if (s.handNumber === 0) {
    s.buttonIndex = eligibleIndices[0];
  } else {
    // Advance button to the next eligible seat.
    const next = nextSeatIndex(s.seats, s.buttonIndex, (seat) => seat.sittingOut);
    if (next === null) throw new Error('No eligible seat for button');
    s.buttonIndex = next;
  }

  s.handNumber += 1;

  // Reset per-hand seat fields.
  for (const seat of s.seats) {
    seat.holeCards = [];
    seat.committed = 0;
    seat.totalCommitted = 0;
    seat.hasFolded = false;
    seat.isAllIn = false;
    seat.hasActedThisRound = false;
  }

  s.board = [];
  s.pots = [];
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  s.toActIndex = null;
  s.lastAggressorIndex = null;
  s.lastResult = null;
  s.log = [...s.log, `--- Hand #${s.handNumber} ---`];

  // Shuffle deck and deal hole cards.
  let deck = shuffle(createDeck());

  // Identify dealt-in players (not sitting out).
  const dealtIndices = eligibleIndices;
  const headsUp = dealtIndices.length === 2;

  // Post blinds.
  // Heads-up rule: button is SB and acts first preflop; the other player is BB.
  let sbIndex: number;
  let bbIndex: number;

  if (headsUp) {
    sbIndex = s.buttonIndex;
    bbIndex = dealtIndices.find((i) => i !== sbIndex)!;
  } else {
    // SB is first after button; BB is second.
    const afterButton = nextSeatIndex(s.seats, s.buttonIndex, (seat) => seat.sittingOut);
    sbIndex = afterButton!;
    const afterSB = nextSeatIndex(s.seats, sbIndex, (seat) => seat.sittingOut);
    bbIndex = afterSB!;
  }

  const { config } = s;

  // Post small blind.
  const sbSeat = s.seats[sbIndex];
  const sbAmount = Math.min(config.smallBlind, sbSeat.player.stack);
  sbSeat.player.stack -= sbAmount;
  sbSeat.committed += sbAmount;
  sbSeat.totalCommitted += sbAmount;
  if (sbSeat.player.stack === 0) sbSeat.isAllIn = true;
  s.log.push(`${seatName(sbSeat)} posts small blind (${sbAmount})`);

  // Post big blind.
  const bbSeat = s.seats[bbIndex];
  const bbAmount = Math.min(config.bigBlind, bbSeat.player.stack);
  bbSeat.player.stack -= bbAmount;
  bbSeat.committed += bbAmount;
  bbSeat.totalCommitted += bbAmount;
  if (bbSeat.player.stack === 0) bbSeat.isAllIn = true;
  s.log.push(`${seatName(bbSeat)} posts big blind (${bbAmount})`);

  s.currentBet = bbAmount;
  s.minRaise = config.bigBlind;

  // Deal 2 hole cards to each active player.
  for (const i of dealtIndices) {
    const result = deal(deck, 2);
    s.seats[i].holeCards = result.dealt;
    deck = result.rest;
  }
  s.deck = deck;

  s.phase = 'preflop';

  // First to act preflop:
  // Heads-up: button/SB acts first.
  // Otherwise: player left of BB.
  if (headsUp) {
    s.toActIndex = sbIndex; // button/SB acts first heads-up preflop
  } else {
    const leftOfBB = nextSeatIndex(s.seats, bbIndex, (seat) => seat.sittingOut);
    s.toActIndex = leftOfBB;
  }

  // BB gets the option to act even if no raise happened — so BB hasn't "acted" yet
  // (they posted, but that's not a voluntary action).
  // We track this correctly: hasActedThisRound starts false for all, meaning
  // the round ends when all actionable players have acted and matched currentBet.

  return s;
}

/**
 * Return which actions are legal for the seat that is currently to act.
 */
export function getLegalActions(state: GameState): LegalActions {
  if (state.toActIndex === null) throw new Error('No seat is currently to act');
  const seat = state.seats[state.toActIndex];
  const { currentBet, minRaise, config } = state;

  const callAmount = Math.min(currentBet - seat.committed, seat.player.stack);
  const canCheck = callAmount === 0 && currentBet === seat.committed;
  const canCall = callAmount > 0 && callAmount < seat.player.stack;

  // Bet/Raise: only if there are chips to put in.
  const canBet = currentBet === 0 && seat.player.stack > 0;
  const canRaise = currentBet > 0 && seat.player.stack > callAmount;

  // Min raise-to: current bet + minRaise increment (or just bigBlind if opening).
  const minRaiseTo = Math.min(currentBet + minRaise, seat.committed + seat.player.stack);
  // Max raise-to = all-in.
  const maxRaiseTo = seat.committed + seat.player.stack;

  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
  };

  void config; // suppress unused warning
}

/**
 * Apply a player action (fold/check/call/bet/raise/allin) from a given seat.
 */
export function applyAction(state: GameState, seatIndex: number, action: Action): GameState {
  if (state.toActIndex !== seatIndex) {
    throw new Error(`It is not seat ${seatIndex}'s turn (toActIndex=${state.toActIndex})`);
  }

  const legal = getLegalActions(state);
  let s = cloneState(state);
  const seat = s.seats[seatIndex];

  switch (action.type) {
    case 'fold': {
      seat.hasFolded = true;
      seat.hasActedThisRound = true;
      s.log.push(`${seatName(seat)} folds`);
      break;
    }

    case 'check': {
      if (!legal.canCheck) throw new Error('Cannot check — there is a bet to call');
      seat.hasActedThisRound = true;
      s.log.push(`${seatName(seat)} checks`);
      break;
    }

    case 'call': {
      if (!legal.canCall && legal.callAmount > 0) {
        // If callAmount > 0 but canCall is false, it means it's an all-in call.
      }
      if (legal.callAmount === 0) throw new Error('Nothing to call');
      const callChips = Math.min(legal.callAmount, seat.player.stack);
      seat.player.stack -= callChips;
      seat.committed += callChips;
      seat.totalCommitted += callChips;
      if (seat.player.stack === 0) {
        seat.isAllIn = true;
        s.log.push(`${seatName(seat)} calls ${callChips} (all-in)`);
      } else {
        s.log.push(`${seatName(seat)} calls ${callChips}`);
      }
      seat.hasActedThisRound = true;
      break;
    }

    case 'bet': {
      if (!legal.canBet) throw new Error('Cannot bet — there is already a bet');
      const betAmount = action.amount ?? legal.minRaiseTo;
      if (betAmount < legal.minRaiseTo && betAmount < seat.player.stack + seat.committed) {
        throw new Error(`Bet ${betAmount} is below minimum ${legal.minRaiseTo}`);
      }
      const betChips = Math.min(betAmount - seat.committed, seat.player.stack);
      seat.player.stack -= betChips;
      seat.committed += betChips;
      seat.totalCommitted += betChips;
      const newBet = seat.committed;
      const raiseSize = newBet - s.currentBet;
      // Only update minRaise if this is a full raise.
      if (raiseSize >= s.minRaise) {
        s.minRaise = raiseSize;
      }
      s.currentBet = newBet;
      s.lastAggressorIndex = seatIndex;
      // A bet/raise reopens action — reset hasActedThisRound for others.
      for (let i = 0; i < s.seats.length; i++) {
        if (i !== seatIndex && !s.seats[i].hasFolded && !s.seats[i].isAllIn && !s.seats[i].sittingOut) {
          s.seats[i].hasActedThisRound = false;
        }
      }
      if (seat.player.stack === 0) {
        seat.isAllIn = true;
        s.log.push(`${seatName(seat)} bets ${betChips} (all-in)`);
      } else {
        s.log.push(`${seatName(seat)} bets ${betChips}`);
      }
      seat.hasActedThisRound = true;
      break;
    }

    case 'raise': {
      if (!legal.canRaise) throw new Error('Cannot raise');
      const raiseTo = action.amount ?? legal.minRaiseTo;
      if (raiseTo < legal.minRaiseTo && raiseTo < legal.maxRaiseTo) {
        throw new Error(`Raise to ${raiseTo} is below minimum ${legal.minRaiseTo}`);
      }
      const capRaiseTo = Math.min(raiseTo, legal.maxRaiseTo);
      const raiseChips = capRaiseTo - seat.committed;
      const actualChips = Math.min(raiseChips, seat.player.stack);
      seat.player.stack -= actualChips;
      seat.committed += actualChips;
      seat.totalCommitted += actualChips;
      const newBet = seat.committed;
      const raiseIncrement = newBet - s.currentBet;
      // Only update minRaise if this is a full (or larger) raise.
      if (raiseIncrement >= s.minRaise) {
        s.minRaise = raiseIncrement;
      }
      s.currentBet = newBet;
      s.lastAggressorIndex = seatIndex;
      // Reopen action for others.
      if (raiseIncrement >= state.minRaise) {
        for (let i = 0; i < s.seats.length; i++) {
          if (i !== seatIndex && !s.seats[i].hasFolded && !s.seats[i].isAllIn && !s.seats[i].sittingOut) {
            s.seats[i].hasActedThisRound = false;
          }
        }
      }
      if (seat.player.stack === 0) {
        seat.isAllIn = true;
        s.log.push(`${seatName(seat)} raises to ${seat.committed} (all-in)`);
      } else {
        s.log.push(`${seatName(seat)} raises to ${seat.committed}`);
      }
      seat.hasActedThisRound = true;
      break;
    }

    case 'allin': {
      const allInChips = seat.player.stack;
      if (allInChips <= 0) throw new Error('No chips to go all-in with');
      seat.player.stack = 0;
      seat.committed += allInChips;
      seat.totalCommitted += allInChips;
      const newBet = seat.committed;
      const raiseIncrement = newBet - s.currentBet;
      if (newBet > s.currentBet) {
        // Only update minRaise if this is a full raise.
        if (raiseIncrement >= s.minRaise) {
          s.minRaise = raiseIncrement;
          // Reopen action for others since it's a full raise.
          for (let i = 0; i < s.seats.length; i++) {
            if (i !== seatIndex && !s.seats[i].hasFolded && !s.seats[i].isAllIn && !s.seats[i].sittingOut) {
              s.seats[i].hasActedThisRound = false;
            }
          }
        }
        // Short all-in: does NOT reopen action (minRaise unchanged).
        s.currentBet = newBet;
        s.lastAggressorIndex = seatIndex;
      }
      seat.isAllIn = true;
      seat.hasActedThisRound = true;
      s.log.push(`${seatName(seat)} goes all-in for ${allInChips}`);
      break;
    }

    default:
      throw new Error(`Unknown action type: ${(action as Action).type}`);
  }

  // After action: check for end conditions.
  const remaining = activeSeatIndices(s.seats);

  if (remaining.length <= 1) {
    // All but one player folded — immediate win.
    const winnerId = remaining.length === 1 ? s.seats[remaining[0]].player.id : null;
    // Collect pots.
    s.pots = buildSidePots(s);
    const result = distributePots(s);

    // Actually award the stacks.
    for (const dist of result.distributions) {
      const winSeat = s.seats.find((seat) => seat.player.id === dist.playerId);
      if (winSeat) winSeat.player.stack += dist.amount;
    }

    if (winnerId) {
      const winSeat = s.seats.find((seat) => seat.player.id === winnerId)!;
      const totalWon = result.distributions
        .filter((d) => d.playerId === winnerId)
        .reduce((sum, d) => sum + d.amount, 0);
      s.log.push(`${seatName(winSeat)} wins ${totalWon} (everyone else folded)`);
    }

    s.lastResult = result;
    s.phase = 'handover';
    s.toActIndex = null;
    return s;
  }

  // Advance toActIndex to next eligible seat.
  const actionable = new Set(actionableSeatIndices(s.seats));

  if (isBettingRoundComplete(s)) {
    // Collect committed chips into pots.
    s.pots = buildSidePots(s);
    s.toActIndex = null;
    // phase stays the same; the store calls dealNextStreet.
  } else {
    // Find next actionable seat after current.
    let next: number | null = null;
    const n = s.seats.length;
    for (let i = 1; i < n; i++) {
      const idx = (seatIndex + i) % n;
      if (actionable.has(idx)) {
        next = idx;
        break;
      }
    }
    s.toActIndex = next;
  }

  return s;
}

/**
 * Deal the next community cards (flop / turn / river) and open next betting round.
 */
export function dealNextStreet(state: GameState): GameState {
  if (state.toActIndex !== null) {
    throw new Error('Betting round is not yet complete');
  }

  let s = cloneState(state);

  // Reset per-round fields.
  for (const seat of s.seats) {
    seat.committed = 0;
    seat.hasActedThisRound = false;
  }
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  s.lastAggressorIndex = null;

  switch (s.phase) {
    case 'preflop': {
      // Deal flop: burn 1, deal 3.
      let { rest } = deal(s.deck, 1); // burn
      const flop = deal(rest, 3);
      s.board = [...s.board, ...flop.dealt];
      s.deck = flop.rest;
      s.phase = 'flop';
      s.log.push(`Flop: ${cardsToString(flop.dealt)}`);
      break;
    }
    case 'flop': {
      let { rest } = deal(s.deck, 1); // burn
      const turn = deal(rest, 1);
      s.board = [...s.board, ...turn.dealt];
      s.deck = turn.rest;
      s.phase = 'turn';
      s.log.push(`Turn: ${cardsToString(turn.dealt)}`);
      break;
    }
    case 'turn': {
      let { rest } = deal(s.deck, 1); // burn
      const river = deal(rest, 1);
      s.board = [...s.board, ...river.dealt];
      s.deck = river.rest;
      s.phase = 'river';
      s.log.push(`River: ${cardsToString(river.dealt)}`);
      break;
    }
    case 'river': {
      s.phase = 'showdown';
      break;
    }
    case 'showdown':
    case 'handover':
    case 'idle':
      throw new Error(`Cannot deal next street in phase: ${s.phase}`);
  }

  if (s.phase === 'showdown') {
    s.toActIndex = null;
    return s;
  }

  // Set toActIndex for the new street.
  const actionable = actionableSeatIndices(s.seats);
  if (actionable.length < 2) {
    // Not enough players can act — run out the board.
    s.toActIndex = null;
  } else {
    s.toActIndex = firstToActPostFlop(s);
  }

  return s;
}

/**
 * Run the showdown: evaluate all non-folded hands, award pots, return result.
 */
export function runShowdown(state: GameState): GameState {
  if (state.phase !== 'showdown') {
    throw new Error(`Cannot run showdown in phase: ${state.phase}`);
  }

  let s = cloneState(state);

  // Evaluate each non-folded seat's hand.
  const active = activeSeatIndices(s.seats).filter((i) => !s.seats[i].hasFolded);

  // Build side pots (may already be built, but recalculate for safety).
  s.pots = buildSidePots(s);

  const result = distributePots(s);

  // Award chips to winners.
  for (const dist of result.distributions) {
    const seat = s.seats.find((seat) => seat.player.id === dist.playerId);
    if (seat) seat.player.stack += dist.amount;
  }

  // Log results.
  for (const winner of result.winners) {
    const seat = s.seats.find((s) => s.player.id === winner.playerId)!;
    const totalWon = result.distributions
      .filter((d) => d.playerId === winner.playerId)
      .reduce((sum, d) => sum + d.amount, 0);
    if (winner.hand) {
      s.log.push(`${seatName(seat)} wins ${totalWon} with ${winner.hand.description}`);
    } else {
      s.log.push(`${seatName(seat)} wins ${totalWon}`);
    }
  }

  s.lastResult = result;
  s.phase = 'handover';
  s.toActIndex = null;

  void active; // suppress unused warning
  return s;
}

/**
 * Build side pots and distribute them based on hand rankings.
 * Used internally by runShowdown; exported for testing.
 */
export function distributePots(state: GameState): HandResult {
  const pots = state.pots.length > 0 ? state.pots : buildSidePots(state);

  // Evaluate non-folded hands.
  const handByPlayerId = new Map<string, ReturnType<typeof evaluateHand>>();
  for (const seat of state.seats) {
    if (!seat.hasFolded && !seat.sittingOut && seat.holeCards.length === 2) {
      try {
        const hand = evaluateHand([...seat.holeCards, ...state.board]);
        handByPlayerId.set(seat.player.id, hand);
      } catch {
        // Not enough cards (e.g. fold-win before board is dealt) — no hand to evaluate.
      }
    }
  }

  const distributions: PotDistribution[] = [];
  const winnerSet = new Set<string>();

  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const eligible = pot.eligiblePlayerIds;

    if (eligible.length === 0) continue;

    // If only one eligible player, they win.
    if (eligible.length === 1) {
      distributions.push({ playerId: eligible[0], amount: pot.amount, potIndex });
      winnerSet.add(eligible[0]);
      continue;
    }

    // Find the best hand among eligible players.
    const handsInPot = eligible
      .map((id) => ({ id, hand: handByPlayerId.get(id) ?? null }))
      .filter((e) => e.hand !== null) as { id: string; hand: ReturnType<typeof evaluateHand> }[];

    if (handsInPot.length === 0) {
      // No hands evaluated (e.g., everyone folded but one — shouldn't happen in showdown).
      distributions.push({ playerId: eligible[0], amount: pot.amount, potIndex });
      winnerSet.add(eligible[0]);
      continue;
    }

    // Sort by best hand descending.
    handsInPot.sort((a, b) => compareHands(b.hand, a.hand));
    const bestHand = handsInPot[0].hand;

    // Collect all tied winners.
    const potWinners = handsInPot.filter((e) => compareHands(e.hand, bestHand) === 0);

    if (potWinners.length === 1) {
      distributions.push({ playerId: potWinners[0].id, amount: pot.amount, potIndex });
      winnerSet.add(potWinners[0].id);
    } else {
      // Split pot. Odd chip(s) go to earliest position left of the button.
      const split = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount % potWinners.length;

      // Determine seat order left of button for odd chip priority.
      const seatOrderFromButton = buildSeatOrderFromButton(state);
      potWinners.sort(
        (a, b) =>
          seatOrderFromButton.indexOf(a.id) - seatOrderFromButton.indexOf(b.id),
      );

      for (let wi = 0; wi < potWinners.length; wi++) {
        const extra = wi < remainder ? 1 : 0;
        distributions.push({
          playerId: potWinners[wi].id,
          amount: split + extra,
          potIndex,
        });
        winnerSet.add(potWinners[wi].id);
      }
    }
  }

  const winners = [...winnerSet].map((id) => ({
    playerId: id,
    hand: handByPlayerId.get(id) ?? null,
  }));

  return { distributions, winners };
}

/** Returns player IDs in seat order starting from seat left of button. */
function buildSeatOrderFromButton(state: GameState): string[] {
  const n = state.seats.length;
  const order: string[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = (state.buttonIndex + i) % n;
    order.push(state.seats[idx].player.id);
  }
  return order;
}

/**
 * Rebuy a busted seat back into the game.
 * @param state     Current game state.
 * @param seatIndex The seat to rebuy.
 * @param amount    Optional override; defaults to config.rebuyAmount.
 */
export function rebuy(state: GameState, seatIndex: number, amount?: number): GameState {
  const s = cloneState(state);
  const seat = s.seats[seatIndex];
  seat.player.stack = amount ?? s.config.rebuyAmount;
  seat.sittingOut = false;
  s.log.push(`${seatName(seat)} rebuys for ${seat.player.stack}`);
  return s;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cardsToString(cards: ReturnType<typeof deal>['dealt']): string {
  return cards.map((c) => cardToString(c)).join(' ');
}

function cardToString(card: { rank: number; suit: string }): string {
  const rankStr: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  };
  const suitStr: Record<string, string> = {
    spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
  };
  return `${rankStr[card.rank] ?? card.rank}${suitStr[card.suit] ?? card.suit}`;
}
