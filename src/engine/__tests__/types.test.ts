/**
 * Scaffold smoke test — verifies the type contract can be imported
 * and that the engine stub modules exist.
 * Real tests are added in the engine/AI implementation steps.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, Card, Suit, Rank } from '../types';

describe('type contract (scaffold)', () => {
  it('Card type accepts valid suit and rank values', () => {
    const card: Card = { rank: 14 as Rank, suit: 'spades' as Suit };
    expect(card.rank).toBe(14);
    expect(card.suit).toBe('spades');
  });

  it('engine stubs throw "not implemented"', async () => {
    const { createTable } = await import('../engine');
    expect(() => createTable({} as GameState['config'], [])).toThrow('not implemented');
  });

  it('evaluator stubs throw "not implemented"', async () => {
    const { evaluateHand } = await import('../evaluator');
    expect(() => evaluateHand([])).toThrow('not implemented');
  });

  it('ai stubs throw "not implemented"', async () => {
    const { chooseAction } = await import('../ai');
    expect(() => chooseAction({} as GameState, 0)).toThrow('not implemented');
  });
});
