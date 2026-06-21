/**
 * Mock GameState fixture for visual QA of Table component.
 *
 * Scenario: 6-seat game, flop on board, hero has Ac Kh, one opponent is
 * all-in, one has folded, it is the hero's turn to act.
 */
import type { GameState, LegalActions, SeatState, Card } from '../../engine/types';

// ---- Helper builders ----
function card(rank: GameState['board'][number]['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function seat(
  id: string,
  name: string,
  stack: number,
  isHuman: boolean,
  holeCards: Card[],
  committed: number,
  totalCommitted: number,
  hasFolded: boolean,
  isAllIn: boolean,
): SeatState {
  return {
    player: { id, name, stack, isHuman, personality: 'balanced' },
    holeCards,
    committed,
    totalCommitted,
    hasFolded,
    isAllIn,
    hasActedThisRound: false,
    sittingOut: false,
  };
}

// ---- Seats ----
// Seat 0 = hero (bottom-center)
const seats: SeatState[] = [
  // Hero — two hole cards visible
  seat('p0', 'You',      780, true,  [card(14, 'spades'), card(13, 'hearts')], 40, 40, false, false),
  // Seat 1 — called
  seat('p1', 'Marcus',   540, false, [card(7,  'clubs'),  card(2,  'diamonds')], 40, 40, false, false),
  // Seat 2 — raised, all-in
  seat('p2', 'Deja',     0,   false, [card(10, 'hearts'), card(10, 'spades')], 220, 220, false, true),
  // Seat 3 — folded
  seat('p3', 'Carver',   620, false, [],                  0,   20, true,  false),
  // Seat 4 — called
  seat('p4', 'Riles',    405, false, [card(9,  'spades'), card(8,  'spades')], 40, 40, false, false),
  // Seat 5 — active (their turn in the mock; will be overridden to hero for live)
  seat('p5', 'Tanaka',   310, false, [card(4,  'clubs'),  card(4,  'hearts')], 40, 40, false, false),
];

export const mockState: GameState = {
  config: {
    smallBlind:    10,
    bigBlind:      20,
    startingStack: 1000,
    rebuyAmount:   1000,
  },
  seats,
  buttonIndex:         3,   // Carver has the button (folded)
  phase:               'flop',
  board: [
    card(14, 'clubs'),   // Ac
    card(7,  'hearts'),  // 7h
    card(3,  'spades'),  // 3s
  ],
  deck: [],  // not needed for display
  pots: [
    { amount: 460, eligiblePlayerIds: ['p0','p1','p2','p4','p5'] },
  ],
  currentBet:          220,
  minRaise:            180,
  toActIndex:          0,    // hero to act
  lastAggressorIndex:  2,
  handNumber:          7,
  log: [
    'Hand #7 — Deja deals',
    'Marcus calls 20',
    'Deja raises to 220 (all-in)',
    'Carver folds',
    'Riles calls 220',
    'Tanaka calls 220',
    'You to act — 220 to call',
  ],
  lastResult: null,
};

// ---- Legal actions for the hero ----
export const mockLegalActions: LegalActions = {
  canFold:    true,
  canCheck:   false,
  canCall:    true,
  callAmount: 180,   // 220 - 40 already committed
  canBet:     false,
  canRaise:   true,
  minRaiseTo: 400,
  maxRaiseTo: 780,   // hero's stack
};

// ---- Showdown variant ----
export const mockShowdownState: GameState = {
  ...mockState,
  phase: 'showdown',
  board: [
    card(14, 'clubs'),
    card(7,  'hearts'),
    card(3,  'spades'),
    card(14, 'hearts'),  // turn
    card(13, 'clubs'),   // river
  ],
  toActIndex: null,
  lastResult: {
    distributions: [
      { playerId: 'p0', amount: 460, potIndex: 0 },
    ],
    winners: [
      { playerId: 'p0', hand: { category: 'two-pair', ranks: [14,13,7], bestFive: [], description: 'Two pair, Aces and Kings' } },
    ],
  },
};

// ---- Preflop variant — 6 seats, blinds posted, no community cards ----
export const mockPreflopState: GameState = {
  ...mockState,
  phase: 'preflop',
  board: [],
  pots: [],
  toActIndex: 0,
  log: [
    'Hand #8 — Riles deals',
    'Marcus posts SB 10',
    'Deja posts BB 20',
  ],
  lastResult: null,
};

// ---- River variant — all 5 opponents still in, full 5-card board ----
export const mockRiverState: GameState = {
  config: {
    smallBlind:    10,
    bigBlind:      20,
    startingStack: 1000,
    rebuyAmount:   1000,
  },
  seats: [
    // Hero
    seat('p0', 'You',    620,  true,  [card(14, 'spades'), card(13, 'hearts')], 100, 100, false, false),
    // All 5 opponents still in
    seat('p1', 'Marcus', 440,  false, [card(7,  'clubs'),  card(2,  'diamonds')], 100, 100, false, false),
    seat('p2', 'Deja',   390,  false, [card(10, 'hearts'), card(10, 'spades')],   100, 100, false, false),
    seat('p3', 'Carver', 520,  false, [card(9,  'clubs'),  card(8,  'hearts')],   100, 100, false, false),
    seat('p4', 'Riles',  305,  false, [card(9,  'spades'), card(8,  'spades')],   100, 100, false, false),
    seat('p5', 'Tanaka', 210,  false, [card(4,  'clubs'),  card(4,  'hearts')],   100, 100, false, false),
  ],
  buttonIndex:         3,
  phase:               'river',
  board: [
    card(14, 'clubs'),   // Ac
    card(7,  'hearts'),  // 7h
    card(3,  'spades'),  // 3s
    card(14, 'hearts'),  // Ah (turn)
    card(13, 'clubs'),   // Kc (river)
  ],
  deck: [],
  pots: [
    { amount: 600, eligiblePlayerIds: ['p0','p1','p2','p3','p4','p5'] },
  ],
  currentBet:          0,
  minRaise:            20,
  toActIndex:          0,
  lastAggressorIndex:  null,
  handNumber:          8,
  log: [
    'Hand #8 — river dealt',
    'You to act',
  ],
  lastResult: null,
};
