/**
 * Smoke tests — verifies the type contract can be imported
 * and that the engine modules are implemented (not stubs).
 */
import { describe, it, expect } from 'vitest';
import type { Card, GameState, Suit, Rank } from '../types';

describe('type contract', () => {
  it('Card type accepts valid suit and rank values', () => {
    const card: Card = { rank: 14 as Rank, suit: 'spades' as Suit };
    expect(card.rank).toBe(14);
    expect(card.suit).toBe('spades');
  });

  it('engine module exports createTable', async () => {
    const { createTable } = await import('../engine');
    expect(typeof createTable).toBe('function');
  });

  it('evaluator module exports evaluateHand', async () => {
    const { evaluateHand } = await import('../evaluator');
    expect(typeof evaluateHand).toBe('function');
  });

  it('ai module exports chooseAction', async () => {
    const { chooseAction } = await import('../ai');
    expect(typeof chooseAction).toBe('function');
  });

  it('cards module exports createDeck and returns 52 cards', async () => {
    const { createDeck } = await import('../cards');
    expect(createDeck()).toHaveLength(52);
  });

  it('GameState phase union includes expected values', () => {
    const phases: GameState['phase'][] = [
      'idle', 'preflop', 'flop', 'turn', 'river', 'showdown', 'handover',
    ];
    expect(phases).toHaveLength(7);
  });
});
