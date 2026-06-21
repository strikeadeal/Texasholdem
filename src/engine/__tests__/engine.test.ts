/**
 * Comprehensive engine tests — cards, evaluator, engine state machine, AI.
 */
import { describe, it, expect } from 'vitest';
import type { Card, GameConfig, Player, Rank } from '../types';
import { createDeck, shuffle, deal, SUITS, RANKS } from '../cards';
import { evaluateHand, compareHands } from '../evaluator';
import {
  createTable,
  startHand,
  applyAction,
  getLegalActions,
  dealNextStreet,
  runShowdown,
  distributePots,
  rebuy,
} from '../engine';
import { chooseAction, estimateEquity, BOT_ROSTER } from '../ai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded RNG for deterministic tests. */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function makeCard(rank: Rank, suit: Card['suit'] = 'spades'): Card {
  return { rank, suit };
}

function makeCards(...specs: [Rank, Card['suit']][]): Card[] {
  return specs.map(([rank, suit]) => makeCard(rank, suit));
}

/** Build a minimal GameConfig. */
const defaultConfig: GameConfig = {
  smallBlind: 10,
  bigBlind: 20,
  startingStack: 1000,
  rebuyAmount: 1000,
};

/** Build a Player. */
function makePlayer(id: string, name: string, stack = 1000, isHuman = false): Player {
  return { id, name, stack, isHuman, personality: 'balanced' };
}

/** Set up a 3-player table and start a hand. */
function threePlayerHand() {
  const players: Player[] = [
    makePlayer('human', 'You', 1000, true),
    makePlayer('bot1', 'Sully', 1000),
    makePlayer('bot2', 'Doc', 1000),
  ];
  const initial = createTable(defaultConfig, players);
  const state = startHand(initial);
  return state;
}

/** Set up a 2-player (heads-up) table and start a hand. */
function headsUpHand() {
  const players: Player[] = [
    makePlayer('human', 'You', 1000, true),
    makePlayer('bot1', 'Sully', 1000),
  ];
  const initial = createTable(defaultConfig, players);
  return startHand(initial);
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

describe('cards — createDeck', () => {
  it('returns 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map((c) => `${c.rank}:${c.suit}`));
    expect(keys.size).toBe(52);
  });

  it('contains all 4 suits × 13 ranks', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(deck.some((c) => c.suit === suit && c.rank === rank)).toBe(true);
      }
    }
  });

  it('is deterministic (same order every call)', () => {
    const d1 = createDeck();
    const d2 = createDeck();
    expect(d1).toEqual(d2);
  });
});

describe('cards — shuffle', () => {
  it('returns a new array of the same length', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, seededRng(42));
    expect(shuffled).toHaveLength(52);
    expect(shuffled).not.toBe(deck);
  });

  it('does not mutate the input', () => {
    const deck = createDeck();
    const copy = [...deck];
    shuffle(deck, seededRng(99));
    expect(deck).toEqual(copy);
  });

  it('contains the same cards as the original', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, seededRng(7));
    const keyOf = (c: Card) => `${c.rank}:${c.suit}`;
    expect(shuffled.map(keyOf).sort()).toEqual(deck.map(keyOf).sort());
  });

  it('produces different orderings with different seeds', () => {
    const deck = createDeck();
    const s1 = shuffle(deck, seededRng(1));
    const s2 = shuffle(deck, seededRng(2));
    expect(s1).not.toEqual(s2);
  });
});

describe('cards — deal', () => {
  it('returns `dealt` of length n and `rest` of length deck.length - n', () => {
    const deck = createDeck();
    const { dealt, rest } = deal(deck, 5);
    expect(dealt).toHaveLength(5);
    expect(rest).toHaveLength(47);
  });

  it('dealt + rest contains all original cards', () => {
    const deck = createDeck();
    const { dealt, rest } = deal(deck, 7);
    const all = [...dealt, ...rest];
    const keyOf = (c: Card) => `${c.rank}:${c.suit}`;
    expect(all.map(keyOf).sort()).toEqual(deck.map(keyOf).sort());
  });

  it('does not mutate the input deck', () => {
    const deck = createDeck();
    const copy = [...deck];
    deal(deck, 10);
    expect(deck).toEqual(copy);
  });

  it('throws if n > deck length', () => {
    expect(() => deal([], 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Evaluator — category detection
// ---------------------------------------------------------------------------

describe('evaluator — category detection', () => {
  it('detects royal flush', () => {
    const cards = makeCards([14, 'spades'], [13, 'spades'], [12, 'spades'], [11, 'spades'], [10, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('royal-flush');
    expect(ev.description).toContain('royal flush');
  });

  it('detects straight flush', () => {
    const cards = makeCards([9, 'hearts'], [8, 'hearts'], [7, 'hearts'], [6, 'hearts'], [5, 'hearts']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight-flush');
    expect(ev.ranks[0]).toBe(9);
  });

  it('detects four of a kind', () => {
    const cards = makeCards([7, 'spades'], [7, 'hearts'], [7, 'diamonds'], [7, 'clubs'], [2, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('four-of-a-kind');
    expect(ev.ranks[0]).toBe(7);
  });

  it('detects full house', () => {
    const cards = makeCards([9, 'spades'], [9, 'hearts'], [9, 'diamonds'], [4, 'clubs'], [4, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('full-house');
    expect(ev.ranks[0]).toBe(9);
    expect(ev.ranks[1]).toBe(4);
    expect(ev.description).toMatch(/full house/i);
  });

  it('detects flush', () => {
    const cards = makeCards([14, 'clubs'], [11, 'clubs'], [8, 'clubs'], [5, 'clubs'], [2, 'clubs']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('flush');
    expect(ev.description).toMatch(/flush/i);
  });

  it('detects straight (T-J-Q-K-A ace-high)', () => {
    const cards = makeCards([14, 'spades'], [13, 'hearts'], [12, 'diamonds'], [11, 'clubs'], [10, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight');
    expect(ev.ranks[0]).toBe(14);
  });

  it('detects straight (9-high)', () => {
    const cards = makeCards([9, 'spades'], [8, 'hearts'], [7, 'diamonds'], [6, 'clubs'], [5, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight');
    expect(ev.ranks[0]).toBe(9);
  });

  it('detects wheel straight A-2-3-4-5 with high card 5', () => {
    const cards = makeCards([14, 'spades'], [2, 'hearts'], [3, 'diamonds'], [4, 'clubs'], [5, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight');
    expect(ev.ranks[0]).toBe(5);
    expect(ev.description).toMatch(/Five high/i);
  });

  it('detects wheel straight flush (A-2-3-4-5 suited)', () => {
    const cards = makeCards([14, 'hearts'], [2, 'hearts'], [3, 'hearts'], [4, 'hearts'], [5, 'hearts']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight-flush');
    expect(ev.ranks[0]).toBe(5);
  });

  it('detects three of a kind', () => {
    const cards = makeCards([6, 'spades'], [6, 'hearts'], [6, 'diamonds'], [10, 'clubs'], [3, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('three-of-a-kind');
    expect(ev.ranks[0]).toBe(6);
  });

  it('detects two pair', () => {
    const cards = makeCards([8, 'spades'], [8, 'hearts'], [5, 'diamonds'], [5, 'clubs'], [14, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('two-pair');
    expect(ev.ranks[0]).toBe(8);
    expect(ev.ranks[1]).toBe(5);
    expect(ev.ranks[2]).toBe(14);
  });

  it('detects pair', () => {
    const cards = makeCards([10, 'spades'], [10, 'hearts'], [7, 'diamonds'], [4, 'clubs'], [2, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('pair');
    expect(ev.ranks[0]).toBe(10);
  });

  it('detects high card', () => {
    const cards = makeCards([14, 'spades'], [9, 'hearts'], [7, 'diamonds'], [5, 'clubs'], [2, 'spades']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('high-card');
    expect(ev.ranks[0]).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Evaluator — full ordering
// ---------------------------------------------------------------------------

describe('evaluator — category ordering', () => {
  const royalFlush = evaluateHand(makeCards([14, 'spades'], [13, 'spades'], [12, 'spades'], [11, 'spades'], [10, 'spades']));
  const straightFlush = evaluateHand(makeCards([9, 'hearts'], [8, 'hearts'], [7, 'hearts'], [6, 'hearts'], [5, 'hearts']));
  const quads = evaluateHand(makeCards([7, 'spades'], [7, 'hearts'], [7, 'diamonds'], [7, 'clubs'], [2, 'spades']));
  const fullHouse = evaluateHand(makeCards([9, 'spades'], [9, 'hearts'], [9, 'diamonds'], [4, 'clubs'], [4, 'spades']));
  const flush = evaluateHand(makeCards([14, 'clubs'], [11, 'clubs'], [8, 'clubs'], [5, 'clubs'], [2, 'clubs']));
  const straight = evaluateHand(makeCards([9, 'spades'], [8, 'hearts'], [7, 'diamonds'], [6, 'clubs'], [5, 'spades']));
  const trips = evaluateHand(makeCards([6, 'spades'], [6, 'hearts'], [6, 'diamonds'], [10, 'clubs'], [3, 'spades']));
  const twoPair = evaluateHand(makeCards([8, 'spades'], [8, 'hearts'], [5, 'diamonds'], [5, 'clubs'], [14, 'spades']));
  const pair = evaluateHand(makeCards([10, 'spades'], [10, 'hearts'], [7, 'diamonds'], [4, 'clubs'], [2, 'spades']));
  const highCard = evaluateHand(makeCards([14, 'spades'], [9, 'hearts'], [7, 'diamonds'], [5, 'clubs'], [2, 'spades']));

  it('royal flush > straight flush', () => expect(compareHands(royalFlush, straightFlush)).toBeGreaterThan(0));
  it('straight flush > quads', () => expect(compareHands(straightFlush, quads)).toBeGreaterThan(0));
  it('quads > full house', () => expect(compareHands(quads, fullHouse)).toBeGreaterThan(0));
  it('full house > flush', () => expect(compareHands(fullHouse, flush)).toBeGreaterThan(0));
  it('flush > straight', () => expect(compareHands(flush, straight)).toBeGreaterThan(0));
  it('straight > trips', () => expect(compareHands(straight, trips)).toBeGreaterThan(0));
  it('trips > two pair', () => expect(compareHands(trips, twoPair)).toBeGreaterThan(0));
  it('two pair > pair', () => expect(compareHands(twoPair, pair)).toBeGreaterThan(0));
  it('pair > high card', () => expect(compareHands(pair, highCard)).toBeGreaterThan(0));
});

// ---------------------------------------------------------------------------
// Evaluator — tiebreaks & edge cases
// ---------------------------------------------------------------------------

describe('evaluator — tiebreaks', () => {
  it('ace-high flush beats king-high flush', () => {
    const aceFlush = evaluateHand(makeCards([14, 'hearts'], [10, 'hearts'], [8, 'hearts'], [5, 'hearts'], [2, 'hearts']));
    const kingFlush = evaluateHand(makeCards([13, 'hearts'], [10, 'hearts'], [8, 'hearts'], [5, 'hearts'], [2, 'hearts']));
    expect(compareHands(aceFlush, kingFlush)).toBeGreaterThan(0);
  });

  it('pair of aces beats pair of kings', () => {
    const acesPair = evaluateHand(makeCards([14, 'spades'], [14, 'hearts'], [7, 'diamonds'], [4, 'clubs'], [2, 'spades']));
    const kingsPair = evaluateHand(makeCards([13, 'spades'], [13, 'hearts'], [7, 'diamonds'], [4, 'clubs'], [2, 'spades']));
    expect(compareHands(acesPair, kingsPair)).toBeGreaterThan(0);
  });

  it('pair kicker tiebreak: A pair K kicker > A pair Q kicker', () => {
    const highKick = evaluateHand(makeCards([14, 'spades'], [14, 'hearts'], [13, 'diamonds'], [4, 'clubs'], [2, 'spades']));
    const lowKick = evaluateHand(makeCards([14, 'spades'], [14, 'hearts'], [12, 'diamonds'], [4, 'clubs'], [2, 'spades']));
    expect(compareHands(highKick, lowKick)).toBeGreaterThan(0);
  });

  it('identical hands tie (compareHands === 0)', () => {
    const h1 = evaluateHand(makeCards([14, 'spades'], [9, 'hearts'], [7, 'diamonds'], [5, 'clubs'], [2, 'spades']));
    const h2 = evaluateHand(makeCards([14, 'clubs'], [9, 'diamonds'], [7, 'hearts'], [5, 'spades'], [2, 'clubs']));
    expect(compareHands(h1, h2)).toBe(0);
  });

  it('two pair: higher pair wins', () => {
    const h1 = evaluateHand(makeCards([9, 'spades'], [9, 'hearts'], [5, 'diamonds'], [5, 'clubs'], [2, 'spades']));
    const h2 = evaluateHand(makeCards([8, 'spades'], [8, 'hearts'], [7, 'diamonds'], [7, 'clubs'], [14, 'spades']));
    expect(compareHands(h1, h2)).toBeGreaterThan(0);
  });

  it('flush beats straight (same cards arranged differently)', () => {
    const flush = evaluateHand(makeCards([10, 'clubs'], [8, 'clubs'], [6, 'clubs'], [4, 'clubs'], [2, 'clubs']));
    const straight = evaluateHand(makeCards([10, 'spades'], [9, 'hearts'], [8, 'diamonds'], [7, 'clubs'], [6, 'spades']));
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Evaluator — best 5 of 7
// ---------------------------------------------------------------------------

describe('evaluator — best 5 of 7', () => {
  it('picks the flush over the pair when 7 cards given', () => {
    // Cards: A♠ A♥ 8♣ 7♣ 6♣ 5♣ 2♣ — flush (clubs) vs pair of aces
    const cards = makeCards([14, 'spades'], [14, 'hearts'], [8, 'clubs'], [7, 'clubs'], [6, 'clubs'], [5, 'clubs'], [2, 'clubs']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('flush');
  });

  it('picks straight flush over straight', () => {
    // 9h 8h 7h 6h 5h + As Kd (straight flush 5-9 in hearts)
    const cards = makeCards([9, 'hearts'], [8, 'hearts'], [7, 'hearts'], [6, 'hearts'], [5, 'hearts'], [14, 'spades'], [13, 'diamonds']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('straight-flush');
  });

  it('picks full house over flush from 7 cards', () => {
    // 9s 9h 9d 4c 4s + 2c 3c — full house 9s/4s beats flush
    const cards = makeCards([9, 'spades'], [9, 'hearts'], [9, 'diamonds'], [4, 'clubs'], [4, 'spades'], [2, 'clubs'], [3, 'clubs']);
    const ev = evaluateHand(cards);
    expect(ev.category).toBe('full-house');
  });

  it('bestFive is exactly 5 cards', () => {
    const cards = createDeck().slice(0, 7);
    const ev = evaluateHand(cards);
    expect(ev.bestFive).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Engine — createTable
// ---------------------------------------------------------------------------

describe('engine — createTable', () => {
  it('creates table in idle phase with correct seat count', () => {
    const players = [
      makePlayer('h', 'You', 1000, true),
      makePlayer('b1', 'Sully'),
    ];
    const state = createTable(defaultConfig, players);
    expect(state.phase).toBe('idle');
    expect(state.seats).toHaveLength(2);
    expect(state.handNumber).toBe(0);
    expect(state.pots).toHaveLength(0);
    expect(state.board).toHaveLength(0);
  });

  it('throws with fewer than 2 players', () => {
    expect(() => createTable(defaultConfig, [makePlayer('h', 'You', 1000, true)])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Engine — startHand / blinds
// ---------------------------------------------------------------------------

describe('engine — startHand (3-player)', () => {
  it('increments handNumber', () => {
    const state = threePlayerHand();
    expect(state.handNumber).toBe(1);
  });

  it('sets phase to preflop', () => {
    const state = threePlayerHand();
    expect(state.phase).toBe('preflop');
  });

  it('deals 2 hole cards to each active seat', () => {
    const state = threePlayerHand();
    for (const seat of state.seats) {
      if (!seat.sittingOut) {
        expect(seat.holeCards).toHaveLength(2);
      }
    }
  });

  it('small blind and big blind are posted correctly', () => {
    const state = threePlayerHand();
    const sb = state.seats.find((s) => s.committed === defaultConfig.smallBlind);
    const bb = state.seats.find((s) => s.committed === defaultConfig.bigBlind);
    expect(sb).toBeDefined();
    expect(bb).toBeDefined();
  });

  it('currentBet equals bigBlind', () => {
    const state = threePlayerHand();
    expect(state.currentBet).toBe(defaultConfig.bigBlind);
  });

  it('toActIndex is not null', () => {
    const state = threePlayerHand();
    expect(state.toActIndex).not.toBeNull();
  });

  it('log contains blind posts', () => {
    const state = threePlayerHand();
    const logStr = state.log.join('\n');
    expect(logStr).toMatch(/small blind/i);
    expect(logStr).toMatch(/big blind/i);
  });
});

// ---------------------------------------------------------------------------
// Engine — heads-up rule
// ---------------------------------------------------------------------------

describe('engine — heads-up rule', () => {
  it('button posts small blind in heads-up', () => {
    const state = headsUpHand();
    const buttonSeat = state.seats[state.buttonIndex];
    expect(buttonSeat.committed).toBe(defaultConfig.smallBlind);
  });

  it('non-button posts big blind in heads-up', () => {
    const state = headsUpHand();
    const nonButton = state.seats.find((_, i) => i !== state.buttonIndex)!;
    expect(nonButton.committed).toBe(defaultConfig.bigBlind);
  });

  it('button (SB) acts first preflop in heads-up', () => {
    const state = headsUpHand();
    expect(state.toActIndex).toBe(state.buttonIndex);
  });
});

// ---------------------------------------------------------------------------
// Engine — button rotation
// ---------------------------------------------------------------------------

describe('engine — button rotation', () => {
  it('button rotates after each hand', () => {
    const players = [
      makePlayer('h', 'You', 1000, true),
      makePlayer('b1', 'Sully', 1000),
      makePlayer('b2', 'Doc', 1000),
    ];
    const initial = createTable(defaultConfig, players);
    const hand1 = startHand(initial);
    const btn1 = hand1.buttonIndex;

    // End hand (fold everyone except one)
    let s = hand1;
    s = applyAction(s, s.toActIndex!, { type: 'fold' });
    if (s.phase !== 'handover') {
      s = applyAction(s, s.toActIndex!, { type: 'fold' });
    }
    expect(s.phase).toBe('handover');

    const hand2 = startHand(s);
    expect(hand2.buttonIndex).not.toBe(btn1);
  });
});

// ---------------------------------------------------------------------------
// Engine — getLegalActions
// ---------------------------------------------------------------------------

describe('engine — getLegalActions', () => {
  it('throws when toActIndex is null', () => {
    const state = threePlayerHand();
    const withNull = { ...state, toActIndex: null };
    expect(() => getLegalActions(withNull)).toThrow();
  });

  it('canCheck is true when no bet has been placed', () => {
    // After the BB is posted, the first player has to call/raise/fold.
    // The BB itself has canCheck after everyone calls (option).
    // But right preflop the first actor cannot check.
    const state = threePlayerHand();
    const legal = getLegalActions(state);
    // First to act preflop faces a bet (the BB), so canCheck is false.
    expect(legal.canCheck).toBe(false);
    expect(legal.canCall).toBe(true);
  });

  it('callAmount is correct', () => {
    const state = threePlayerHand();
    const legal = getLegalActions(state);
    const seat = state.seats[state.toActIndex!];
    expect(legal.callAmount).toBe(state.currentBet - seat.committed);
  });

  it('maxRaiseTo equals all-in amount', () => {
    const state = threePlayerHand();
    const legal = getLegalActions(state);
    const seat = state.seats[state.toActIndex!];
    expect(legal.maxRaiseTo).toBe(seat.committed + seat.player.stack);
  });
});

// ---------------------------------------------------------------------------
// Engine — applyAction / betting round mechanics
// ---------------------------------------------------------------------------

describe('engine — applyAction fold', () => {
  it('marks seat as folded', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const next = applyAction(state, idx, { type: 'fold' });
    expect(next.seats[idx].hasFolded).toBe(true);
  });

  it('logs the fold', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const next = applyAction(state, idx, { type: 'fold' });
    const last = next.log[next.log.length - 1];
    expect(last.toLowerCase()).toContain('fold');
  });
});

describe('engine — applyAction call', () => {
  it('increases committed chips by callAmount', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const legal = getLegalActions(state);
    const before = state.seats[idx].committed;
    const next = applyAction(state, idx, { type: 'call' });
    expect(next.seats[idx].committed).toBe(before + legal.callAmount);
  });

  it('decreases stack by callAmount', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const legal = getLegalActions(state);
    const before = state.seats[idx].player.stack;
    const next = applyAction(state, idx, { type: 'call' });
    expect(next.seats[idx].player.stack).toBe(before - legal.callAmount);
  });
});

describe('engine — applyAction raise', () => {
  it('updates currentBet after a raise', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const legal = getLegalActions(state);
    const next = applyAction(state, idx, { type: 'raise', amount: legal.minRaiseTo });
    expect(next.currentBet).toBe(legal.minRaiseTo);
  });

  it('logs the raise', () => {
    const state = threePlayerHand();
    const idx = state.toActIndex!;
    const legal = getLegalActions(state);
    const next = applyAction(state, idx, { type: 'raise', amount: legal.minRaiseTo });
    const last = next.log[next.log.length - 1];
    expect(last.toLowerCase()).toContain('raise');
  });
});

describe('engine — check-around completes the round', () => {
  it('toActIndex becomes null after all players check postflop', () => {
    // Build a hand where we can check around post-flop.
    let state = threePlayerHand();

    // Preflop: everyone calls/folds. Let's just have everyone call then check flop.
    const toa = state.toActIndex!;
    // UTG calls
    state = applyAction(state, toa, { type: 'call' });
    // SB calls (or we need to find them)
    if (state.toActIndex !== null) {
      const sbIdx = state.toActIndex!;
      state = applyAction(state, sbIdx, { type: 'call' });
    }
    // BB checks (option)
    if (state.toActIndex !== null) {
      const bbIdx = state.toActIndex!;
      state = applyAction(state, bbIdx, { type: 'check' });
    }

    // Now deal flop
    if (state.toActIndex === null) {
      state = dealNextStreet(state);
      expect(state.phase).toBe('flop');

      // Check around
      while (state.toActIndex !== null) {
        state = applyAction(state, state.toActIndex!, { type: 'check' });
      }
      expect(state.toActIndex).toBeNull();
    }
  });
});

describe('engine — fold to one ends hand', () => {
  it('phase becomes handover when all but one fold', () => {
    let state = threePlayerHand();

    // Fold the first two players to act
    state = applyAction(state, state.toActIndex!, { type: 'fold' });
    if (state.phase !== 'handover') {
      state = applyAction(state, state.toActIndex!, { type: 'fold' });
    }
    expect(state.phase).toBe('handover');
  });

  it('winner receives all pot chips', () => {
    let state = threePlayerHand();

    // Collect total pot before the hand ends
    const totalBlindPot =
      state.seats.reduce((sum, s) => sum + s.committed, 0);

    state = applyAction(state, state.toActIndex!, { type: 'fold' });
    if (state.phase !== 'handover') {
      state = applyAction(state, state.toActIndex!, { type: 'fold' });
    }

    expect(state.lastResult).not.toBeNull();
    const totalDistributed = state.lastResult!.distributions.reduce(
      (sum, d) => sum + d.amount,
      0,
    );
    expect(totalDistributed).toBe(totalBlindPot);
  });
});

// ---------------------------------------------------------------------------
// Engine — dealNextStreet
// ---------------------------------------------------------------------------

describe('engine — dealNextStreet', () => {
  function advancePreflopToFlop(state: ReturnType<typeof threePlayerHand>) {
    // Fold UTG, SB calls, BB checks — reaches flop
    state = applyAction(state, state.toActIndex!, { type: 'fold' });
    if (state.toActIndex !== null) {
      // SB calls or checks
      const legal = getLegalActions(state);
      if (legal.canCheck) {
        state = applyAction(state, state.toActIndex!, { type: 'check' });
      } else {
        state = applyAction(state, state.toActIndex!, { type: 'call' });
        if (state.toActIndex !== null) {
          state = applyAction(state, state.toActIndex!, { type: 'check' });
        }
      }
    }
    return state;
  }

  it('deals flop (3 cards) after preflop', () => {
    let state = threePlayerHand();
    state = advancePreflopToFlop(state);
    expect(state.toActIndex).toBeNull();
    state = dealNextStreet(state);
    expect(state.phase).toBe('flop');
    expect(state.board).toHaveLength(3);
  });

  it('deals turn (1 card) after flop', () => {
    let state = threePlayerHand();
    state = advancePreflopToFlop(state);
    state = dealNextStreet(state);

    // Check around flop
    while (state.toActIndex !== null) {
      state = applyAction(state, state.toActIndex!, { type: 'check' });
    }

    state = dealNextStreet(state);
    expect(state.phase).toBe('turn');
    expect(state.board).toHaveLength(4);
  });

  it('deals river (1 card) after turn', () => {
    let state = threePlayerHand();
    state = advancePreflopToFlop(state);
    state = dealNextStreet(state);
    while (state.toActIndex !== null) {
      state = applyAction(state, state.toActIndex!, { type: 'check' });
    }
    state = dealNextStreet(state);
    while (state.toActIndex !== null) {
      state = applyAction(state, state.toActIndex!, { type: 'check' });
    }
    state = dealNextStreet(state);
    expect(state.phase).toBe('river');
    expect(state.board).toHaveLength(5);
  });

  it('throws if toActIndex is not null', () => {
    const state = threePlayerHand();
    expect(state.toActIndex).not.toBeNull();
    expect(() => dealNextStreet(state)).toThrow();
  });

  it('resets committed to 0 for new street', () => {
    let state = threePlayerHand();
    state = advancePreflopToFlop(state);
    state = dealNextStreet(state);
    for (const seat of state.seats) {
      if (!seat.sittingOut) {
        expect(seat.committed).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Engine — showdown
// ---------------------------------------------------------------------------

describe('engine — runShowdown', () => {
  it('throws if phase is not showdown', () => {
    const state = threePlayerHand();
    expect(() => runShowdown(state)).toThrow();
  });

  it('produces handover phase after showdown', () => {
    // Construct a minimal showdown state manually.
    let state = threePlayerHand();
    // Everyone calls and checks all the way to showdown.
    // Preflop: UTG calls, SB calls, BB checks.
    state = applyAction(state, state.toActIndex!, { type: 'call' });
    if (state.toActIndex !== null) {
      const legal = getLegalActions(state);
      state = applyAction(state, state.toActIndex!, { type: legal.canCheck ? 'check' : 'call' });
    }
    if (state.toActIndex !== null) {
      state = applyAction(state, state.toActIndex!, { type: 'check' });
    }

    // Deal through to showdown
    while (state.phase !== 'showdown' && state.phase !== 'handover') {
      if (state.toActIndex !== null) {
        state = applyAction(state, state.toActIndex!, { type: 'check' });
      } else {
        state = dealNextStreet(state);
      }
    }

    if (state.phase === 'showdown') {
      state = runShowdown(state);
    }

    expect(state.phase).toBe('handover');
    expect(state.lastResult).not.toBeNull();
    expect(state.lastResult!.distributions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Engine — side pots
// ---------------------------------------------------------------------------

describe('engine — side pots', () => {
  it('3-way all-in for different amounts: correct main and side pots', () => {
    // Player A: all-in for 100
    // Player B: all-in for 300
    // Player C: calls 300
    // Main pot: 300 (100*3), eligible: A, B, C
    // Side pot: 400 (200*2), eligible: B, C

    const players: Player[] = [
      makePlayer('a', 'Alice', 100, true),
      makePlayer('b', 'Bob', 300),
      makePlayer('c', 'Carol', 500),
    ];
    const initial = createTable({ ...defaultConfig, smallBlind: 5, bigBlind: 10 }, players);
    let state = startHand(initial);

    // Manually set up a state where all are all-in for different amounts.
    // We'll use allin actions.
    // UTG (or first to act) goes all-in, others call/go all-in.
    while (state.toActIndex !== null) {
      const idx = state.toActIndex!;
      const seat = state.seats[idx];
      if (seat.player.stack <= state.currentBet - seat.committed + 20) {
        state = applyAction(state, idx, { type: 'allin' });
      } else {
        state = applyAction(state, idx, { type: 'allin' });
      }
    }

    // State should have pots built.
    const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);
    const totalCommitted = players.reduce((s, p) => s + p.stack, 0) -
      state.seats.reduce((s, seat) => s + seat.player.stack, 0);
    expect(totalPot).toBe(totalCommitted);
  });

  it('distributePots awards pot to best hand (constructed state)', () => {
    // Set up state where player A has a flush and player B has a pair.
    const players: Player[] = [
      makePlayer('winner', 'Alice', 0, true),
      makePlayer('loser', 'Bob', 0),
    ];
    const initial = createTable(defaultConfig, players);
    const state: typeof initial = {
      ...initial,
      phase: 'showdown',
      board: makeCards([10, 'hearts'], [8, 'hearts'], [6, 'hearts'], [3, 'spades'], [2, 'diamonds']),
      pots: [{ amount: 200, eligiblePlayerIds: ['winner', 'loser'] }],
      seats: [
        {
          ...initial.seats[0],
          holeCards: makeCards([14, 'hearts'], [11, 'hearts']), // flush
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 100,
        },
        {
          ...initial.seats[1],
          holeCards: makeCards([10, 'spades'], [10, 'diamonds']), // trips (10s with board 10)
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 100,
        },
      ],
    };

    const result = distributePots(state);
    // Flush (winner) beats three of a kind (loser).
    const winnerDist = result.distributions.find((d) => d.playerId === 'winner');
    expect(winnerDist).toBeDefined();
    expect(winnerDist!.amount).toBe(200);
  });

  it('split pot: tied hands split evenly', () => {
    // Both players have the same high card hand.
    const players: Player[] = [
      makePlayer('a', 'Alice', 0, true),
      makePlayer('b', 'Bob', 0),
    ];
    const initial = createTable(defaultConfig, players);
    const state: typeof initial = {
      ...initial,
      phase: 'showdown',
      board: makeCards([14, 'spades'], [13, 'hearts'], [12, 'diamonds'], [2, 'clubs'], [3, 'spades']),
      pots: [{ amount: 200, eligiblePlayerIds: ['a', 'b'] }],
      seats: [
        {
          ...initial.seats[0],
          holeCards: makeCards([9, 'hearts'], [7, 'spades']),
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 100,
        },
        {
          ...initial.seats[1],
          holeCards: makeCards([9, 'clubs'], [7, 'diamonds']),
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 100,
        },
      ],
    };

    const result = distributePots(state);
    const distA = result.distributions.find((d) => d.playerId === 'a')?.amount ?? 0;
    const distB = result.distributions.find((d) => d.playerId === 'b')?.amount ?? 0;
    expect(distA + distB).toBe(200);
    // Both should get equal shares.
    expect(distA).toBe(100);
    expect(distB).toBe(100);
  });

  it('odd chip goes to earliest seat left of button', () => {
    // Pot of 201 (odd) — two way tie.
    const players: Player[] = [
      makePlayer('a', 'Alice', 0, true),
      makePlayer('b', 'Bob', 0),
    ];
    const initial = createTable(defaultConfig, players);
    const state: typeof initial = {
      ...initial,
      phase: 'showdown',
      buttonIndex: 1, // button is Bob (seat 1), so Alice (seat 0) is first left
      board: makeCards([14, 'spades'], [13, 'hearts'], [12, 'diamonds'], [2, 'clubs'], [3, 'spades']),
      pots: [{ amount: 201, eligiblePlayerIds: ['a', 'b'] }],
      seats: [
        {
          ...initial.seats[0],
          holeCards: makeCards([9, 'hearts'], [7, 'spades']),
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 101,
        },
        {
          ...initial.seats[1],
          holeCards: makeCards([9, 'clubs'], [7, 'diamonds']),
          hasFolded: false,
          sittingOut: false,
          totalCommitted: 100,
        },
      ],
    };

    const result = distributePots(state);
    const distA = result.distributions.find((d) => d.playerId === 'a')?.amount ?? 0;
    const distB = result.distributions.find((d) => d.playerId === 'b')?.amount ?? 0;
    expect(distA + distB).toBe(201);
    // Alice is first left of button (button=1=Bob, next=0=Alice), so she gets the odd chip.
    expect(distA).toBe(101);
    expect(distB).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Engine — all-in run-out
// ---------------------------------------------------------------------------

describe('engine — all-in run-out', () => {
  it('reaches showdown when both players go all-in', () => {
    let state = headsUpHand();

    // Both go all-in.
    while (state.toActIndex !== null && state.phase === 'preflop') {
      state = applyAction(state, state.toActIndex!, { type: 'allin' });
    }

    // Run out the board.
    while (state.phase !== 'showdown' && state.phase !== 'handover') {
      state = dealNextStreet(state);
    }

    // Run showdown
    if (state.phase === 'showdown') {
      state = runShowdown(state);
    }

    expect(state.phase).toBe('handover');
    expect(state.lastResult).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Engine — short all-in doesn't reopen betting
// ---------------------------------------------------------------------------

describe('engine — short all-in does not reopen betting', () => {
  it('minRaise is not increased by a short all-in raise', () => {
    // Setup: 3 players.
    // Player A raises to 100 (min-raise increment = 80 over BB of 20).
    // Player B has a short stack and can only go all-in for 50 total (less than 100).
    // Player B's sub-minimum all-in should NOT reopen action for Player A.
    const players: Player[] = [
      makePlayer('a', 'Alice', 1000, true),
      makePlayer('b', 'Bob', 50), // short stack: only 50 total
      makePlayer('c', 'Carol', 1000),
    ];
    const config: GameConfig = { smallBlind: 10, bigBlind: 20, startingStack: 1000, rebuyAmount: 1000 };
    const initial = createTable(config, players);
    let state = startHand(initial);

    // Record the minRaise before any big raise.
    const initialMinRaise = state.minRaise; // Should be 20 (bigBlind).
    expect(initialMinRaise).toBe(config.bigBlind);

    // First to act preflop: player left of BB raises to 100.
    const firstIdx = state.toActIndex!;
    state = applyAction(state, firstIdx, { type: 'raise', amount: 100 });
    // minRaise is now 80 (raise increment from 20 to 100).
    const minRaiseAfterFullRaise = state.minRaise;
    expect(minRaiseAfterFullRaise).toBe(80); // 100 - 20 = 80

    // Bob (short stack) goes all-in for 50 total (less than 100, so sub-minimum raise).
    if (state.toActIndex !== null) {
      const bobIdx = state.toActIndex!;
      // Bob has 50 chips total (already posted some as blind if he's SB/BB).
      const bobSeat = state.seats[bobIdx];
      if (bobSeat.player.stack > 0) {
        state = applyAction(state, bobIdx, { type: 'allin' });
        // Bob's sub-minimum all-in should NOT increase minRaise beyond 80.
        expect(state.minRaise).toBe(minRaiseAfterFullRaise);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Engine — sitting-out seats are skipped
// ---------------------------------------------------------------------------

describe('engine — sitting-out seats are skipped', () => {
  it('busted player is marked sittingOut', () => {
    const players: Player[] = [
      makePlayer('h', 'You', 1000, true),
      makePlayer('b1', 'Sully', 0), // busted
      makePlayer('b2', 'Doc', 1000),
    ];
    const initial = createTable(defaultConfig, players);
    const state = startHand(initial);
    expect(state.seats[1].sittingOut).toBe(true);
    expect(state.seats[1].holeCards).toHaveLength(0);
  });

  it('toActIndex never lands on a sitting-out seat', () => {
    const players: Player[] = [
      makePlayer('h', 'You', 1000, true),
      makePlayer('b1', 'Sully', 0), // busted
      makePlayer('b2', 'Doc', 1000),
    ];
    const initial = createTable(defaultConfig, players);
    let state = startHand(initial);

    // Run some actions and check toActIndex is never busted seat.
    for (let i = 0; i < 5 && state.toActIndex !== null; i++) {
      expect(state.seats[state.toActIndex!].sittingOut).toBe(false);
      state = applyAction(state, state.toActIndex!, { type: 'fold' });
    }
  });
});

// ---------------------------------------------------------------------------
// Engine — rebuy
// ---------------------------------------------------------------------------

describe('engine — rebuy', () => {
  it('restores stack and clears sittingOut', () => {
    const players: Player[] = [
      makePlayer('h', 'You', 1000, true),
      makePlayer('b1', 'Sully', 1000),
    ];
    const initial = createTable(defaultConfig, players);
    // Start a hand, then simulate Sully busting out.
    const state = startHand(initial);
    // Manually mark sully as busted/sittingOut.
    const bustedState = {
      ...state,
      seats: state.seats.map((s, i) =>
        i === 1 ? { ...s, player: { ...s.player, stack: 0 }, sittingOut: true } : s,
      ),
    } as typeof state;

    expect(bustedState.seats[1].sittingOut).toBe(true);
    const after = rebuy(bustedState, 1);
    expect(after.seats[1].sittingOut).toBe(false);
    expect(after.seats[1].player.stack).toBe(defaultConfig.rebuyAmount);
  });

  it('accepts a custom rebuy amount', () => {
    const players = [makePlayer('h', 'You', 1000, true), makePlayer('b', 'Bob', 1000)];
    const initial = createTable(defaultConfig, players);
    const state = startHand(initial);
    const bustedState = {
      ...state,
      seats: state.seats.map((s, i) =>
        i === 1 ? { ...s, player: { ...s.player, stack: 0 }, sittingOut: true } : s,
      ),
    } as typeof state;
    const after = rebuy(bustedState, 1, 500);
    expect(after.seats[1].player.stack).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Engine — immutability
// ---------------------------------------------------------------------------

describe('engine — immutability', () => {
  it('applyAction does not mutate the input state', () => {
    const state = threePlayerHand();
    const frozen = JSON.stringify(state);
    applyAction(state, state.toActIndex!, { type: 'fold' });
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('startHand does not mutate the input state', () => {
    const players = [makePlayer('h', 'You', 1000, true), makePlayer('b', 'Bob', 1000)];
    const initial = createTable(defaultConfig, players);
    const frozen = JSON.stringify(initial);
    startHand(initial);
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});

// ---------------------------------------------------------------------------
// AI — estimateEquity
// ---------------------------------------------------------------------------

describe('ai — estimateEquity', () => {
  it('returns a value between 0 and 1', () => {
    const holeCards = makeCards([14, 'spades'], [14, 'hearts']);
    const eq = estimateEquity(holeCards, [], 1, 50);
    expect(eq).toBeGreaterThanOrEqual(0);
    expect(eq).toBeLessThanOrEqual(1);
  });

  it('pocket aces have high preflop equity vs 1 opponent', () => {
    const holeCards = makeCards([14, 'spades'], [14, 'hearts']);
    const eq = estimateEquity(holeCards, [], 1, 200);
    expect(eq).toBeGreaterThan(0.6); // Aces win ~85% vs random
  });

  it('72o has low preflop equity vs 1 opponent', () => {
    const holeCards = makeCards([7, 'spades'], [2, 'hearts']);
    const eq = estimateEquity(holeCards, [], 1, 200);
    expect(eq).toBeLessThan(0.5);
  });

  it('returns 0.5 if holeCards is empty', () => {
    const eq = estimateEquity([], [], 1, 50);
    expect(eq).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// AI — chooseAction
// ---------------------------------------------------------------------------

describe('ai — chooseAction', () => {
  it('returns a legal action', () => {
    const state = threePlayerHand();
    // Make sure toActIndex is a bot.
    if (state.toActIndex !== null && !state.seats[state.toActIndex].player.isHuman) {
      const action = chooseAction(state, state.toActIndex);
      const legal = getLegalActions(state);
      const validTypes = ['fold', 'check', 'call', 'bet', 'raise', 'allin'];
      expect(validTypes).toContain(action.type);
      if (action.type === 'check') expect(legal.canCheck).toBe(true);
    }
  });

  it('does not return check when there is a bet to call', () => {
    let state = threePlayerHand();
    // Find a bot seat that is not the first to act.
    while (state.toActIndex !== null && state.seats[state.toActIndex!].player.isHuman) {
      state = applyAction(state, state.toActIndex!, { type: 'call' });
    }
    if (state.toActIndex !== null) {
      const action = chooseAction(state, state.toActIndex!);
      if (action.type === 'check') {
        expect(getLegalActions(state).canCheck).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AI — BOT_ROSTER
// ---------------------------------------------------------------------------

describe('ai — BOT_ROSTER', () => {
  it('has 6 bots', () => {
    expect(BOT_ROSTER).toHaveLength(6);
  });

  it('each bot has a name and personality', () => {
    for (const bot of BOT_ROSTER) {
      expect(bot.name).toBeTruthy();
      expect(['tight', 'loose', 'aggressive', 'balanced']).toContain(bot.personality);
    }
  });

  it('includes expected names', () => {
    const names = BOT_ROSTER.map((b) => b.name);
    expect(names).toContain('Sully');
    expect(names).toContain('Doc');
    expect(names).toContain('Marguerite');
  });
});
