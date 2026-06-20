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
