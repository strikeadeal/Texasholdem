/**
 * evaluator.ts — 5-card and 7-card hand evaluation.
 * Supports best-5-of-up-to-7 for Texas Hold'em.
 */
import type { Card, EvaluatedHand, HandCategory, Rank } from './types';

// Category ordinal for comparison (higher = better).
const CATEGORY_RANK: Record<HandCategory, number> = {
  'high-card': 0,
  'pair': 1,
  'two-pair': 2,
  'three-of-a-kind': 3,
  'straight': 4,
  'flush': 5,
  'full-house': 6,
  'four-of-a-kind': 7,
  'straight-flush': 8,
  'royal-flush': 9,
};

/** Return all combinations of `k` elements from `arr`. */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/**
 * Evaluate the best 5-card hand from up to 7 cards.
 * Returns an EvaluatedHand whose `ranks` array allows lexicographic comparison.
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) throw new Error(`Need at least 5 cards, got ${cards.length}`);

  if (cards.length === 5) {
    return evaluate5(cards);
  }

  // Try all C(n,5) combinations, pick the best.
  const fiveCardHands = combinations(cards, 5);
  let best: EvaluatedHand | null = null;
  for (const five of fiveCardHands) {
    const ev = evaluate5(five);
    if (best === null || compareHands(ev, best) > 0) {
      best = ev;
    }
  }
  return best!;
}

/** Evaluate exactly 5 cards. */
function evaluate5(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a) as Rank[];
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const straightResult = detectStraight(ranks);
  const isStraight = straightResult !== null;

  if (isFlush && isStraight) {
    const highCard = straightResult!;
    if (highCard === 14) {
      return buildHand('royal-flush', [14], cards, 'a royal flush');
    }
    return buildHand(
      'straight-flush',
      [highCard],
      cards,
      `a straight flush, ${rankName(highCard)} high`,
    );
  }

  // Count rank occurrences.
  const freq = rankFrequency(ranks);
  const groups = groupByFrequency(freq);

  // Four of a kind
  const quads = groups.get(4);
  if (quads && quads.length > 0) {
    const quadRank = quads[0];
    const kickers = ranks.filter((r) => r !== quadRank);
    return buildHand(
      'four-of-a-kind',
      [quadRank, ...kickers],
      cards,
      `four of a kind, ${rankNamePlural(quadRank)}`,
    );
  }

  // Full house
  const trips = groups.get(3);
  const pairs = groups.get(2);
  if (trips && trips.length > 0 && pairs && pairs.length > 0) {
    const tripRank = trips[0];
    const pairRank = pairs[0];
    return buildHand(
      'full-house',
      [tripRank, pairRank],
      cards,
      `a full house, ${rankNamePlural(tripRank)} full of ${rankNamePlural(pairRank)}`,
    );
  }

  if (isFlush) {
    return buildHand('flush', ranks, cards, `a flush, ${rankName(ranks[0])} high`);
  }

  if (isStraight) {
    const highCard = straightResult!;
    return buildHand('straight', [highCard], cards, `a straight, ${rankName(highCard)} high`);
  }

  // Three of a kind
  if (trips && trips.length > 0) {
    const tripRank = trips[0];
    const kickers = ranks.filter((r) => r !== tripRank);
    return buildHand(
      'three-of-a-kind',
      [tripRank, ...kickers],
      cards,
      `three of a kind, ${rankNamePlural(tripRank)}`,
    );
  }

  // Two pair
  if (pairs && pairs.length >= 2) {
    const [highPair, lowPair] = pairs.sort((a, b) => b - a);
    const kicker = ranks.find((r) => r !== highPair && r !== lowPair)!;
    return buildHand(
      'two-pair',
      [highPair, lowPair, kicker],
      cards,
      `two pair, ${rankNamePlural(highPair)} and ${rankNamePlural(lowPair)}`,
    );
  }

  // One pair
  if (pairs && pairs.length === 1) {
    const pairRank = pairs[0];
    const kickers = ranks.filter((r) => r !== pairRank);
    return buildHand(
      'pair',
      [pairRank, ...kickers],
      cards,
      `a pair of ${rankNamePlural(pairRank)}`,
    );
  }

  // High card
  return buildHand('high-card', ranks, cards, `${rankName(ranks[0])} high`);
}

/** Returns the high card of the straight, or null if not a straight. Handles the wheel (A-2-3-4-5). */
function detectStraight(sortedRanks: Rank[]): number | null {
  // Wheel: A-2-3-4-5 (Ace acts as 1)
  const uniqueRanks = [...new Set(sortedRanks)].sort((a, b) => b - a);
  if (uniqueRanks.length < 5) return null;

  // Check for ace-low wheel: A,5,4,3,2
  if (
    uniqueRanks.includes(14) &&
    uniqueRanks.includes(2) &&
    uniqueRanks.includes(3) &&
    uniqueRanks.includes(4) &&
    uniqueRanks.includes(5)
  ) {
    // Wheel: high card is 5
    return 5;
  }

  // Standard straight: 5 consecutive values
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    const slice = uniqueRanks.slice(i, i + 5);
    if (slice[0] - slice[4] === 4) {
      return slice[0];
    }
  }

  return null;
}

function rankFrequency(ranks: Rank[]): Map<Rank, number> {
  const freq = new Map<Rank, number>();
  for (const r of ranks) {
    freq.set(r, (freq.get(r) ?? 0) + 1);
  }
  return freq;
}

/** Group ranks by their frequency. Returns Map<freq, rank[]> sorted desc by rank. */
function groupByFrequency(freq: Map<Rank, number>): Map<number, Rank[]> {
  const groups = new Map<number, Rank[]>();
  for (const [rank, count] of freq) {
    const existing = groups.get(count) ?? [];
    existing.push(rank);
    groups.set(count, existing);
  }
  // Sort each group descending by rank value.
  for (const [, arr] of groups) {
    arr.sort((a, b) => b - a);
  }
  return groups;
}

function buildHand(
  category: HandCategory,
  ranks: number[],
  bestFive: Card[],
  description: string,
): EvaluatedHand {
  return { category, ranks, bestFive, description };
}

const RANK_NAMES: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

const RANK_PLURAL_NAMES: Record<number, string> = {
  2: 'Twos',
  3: 'Threes',
  4: 'Fours',
  5: 'Fives',
  6: 'Sixes',
  7: 'Sevens',
  8: 'Eights',
  9: 'Nines',
  10: 'Tens',
  11: 'Jacks',
  12: 'Queens',
  13: 'Kings',
  14: 'Aces',
};

function rankName(r: number): string {
  return RANK_NAMES[r] ?? String(r);
}

function rankNamePlural(r: number): string {
  return RANK_PLURAL_NAMES[r] ?? String(r) + 's';
}

/**
 * Compare two evaluated hands.
 * Returns >0 if a wins, <0 if b wins, 0 if tie.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const catDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (catDiff !== 0) return catDiff;

  // Same category — compare ranks lexicographically.
  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i++) {
    const ar = a.ranks[i] ?? 0;
    const br = b.ranks[i] ?? 0;
    if (ar !== br) return ar - br;
  }
  return 0;
}
