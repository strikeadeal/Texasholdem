export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
// 11=J, 12=Q, 13=K, 14=A
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export interface Card { rank: Rank; suit: Suit; }

export type Personality = 'tight' | 'loose' | 'aggressive' | 'balanced';

export interface Player {
  id: string;
  name: string;
  stack: number;
  isHuman: boolean;
  personality: Personality;
}

export type GamePhase =
  | 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handover';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export interface Action { type: ActionType; amount?: number; }

export interface SeatState {
  player: Player;
  holeCards: Card[];
  committed: number;       // chips committed in the current betting round
  totalCommitted: number;  // chips committed across the whole hand (for side pots)
  hasFolded: boolean;
  isAllIn: boolean;
  hasActedThisRound: boolean;
  sittingOut: boolean;     // busted with no rebuy yet
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface GameConfig {
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  rebuyAmount: number;
}

export type HandCategory =
  | 'high-card' | 'pair' | 'two-pair' | 'three-of-a-kind' | 'straight'
  | 'flush' | 'full-house' | 'four-of-a-kind' | 'straight-flush' | 'royal-flush';

export interface EvaluatedHand {
  category: HandCategory;
  // tiebreak ranks, highest first; compare lexicographically
  ranks: number[];
  bestFive: Card[];
  description: string; // e.g. "a flush, Queen high"
}

export interface PotDistribution {
  playerId: string;
  amount: number;
  potIndex: number;
}

export interface HandResult {
  distributions: PotDistribution[];
  winners: {
    playerId: string;
    hand: EvaluatedHand | null; // null if won by everyone folding
  }[];
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;     // chips needed to call
  canBet: boolean;        // opening bet (no current bet)
  canRaise: boolean;
  minRaiseTo: number;     // total "raise to" amount for a min legal raise/bet
  maxRaiseTo: number;     // all-in amount (total)
}

export interface GameState {
  config: GameConfig;
  seats: SeatState[];          // fixed seat order; human is seat index 0
  buttonIndex: number;         // dealer button seat index
  phase: GamePhase;
  board: Card[];               // community cards (length 0,3,4,5)
  deck: Card[];                // remaining undealt cards
  pots: Pot[];                 // index 0 = main pot, rest = side pots
  currentBet: number;          // highest `committed` this round
  minRaise: number;            // current min raise increment (chips)
  toActIndex: number | null;   // seat index to act, or null between rounds
  lastAggressorIndex: number | null;
  handNumber: number;
  log: string[];               // human-readable hand log, newest last
  lastResult: HandResult | null;
}
