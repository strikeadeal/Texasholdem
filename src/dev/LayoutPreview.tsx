/**
 * LayoutPreview — dev-only entry for visual QA of Table layout.
 *
 * Load via layout-preview.html?state=preflop|river|showdown
 *
 * Renders a full-viewport Table with mock fixture data so Playwright
 * (or any browser) can QA the layout at any device size with emulated
 * safe-area insets.
 *
 * NOT linked from the main app; harmless if present in the build.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/fonts';
import '../styles/global.css';
import { Table } from '../components/Table';
import {
  mockState,
  mockPreflopState,
  mockRiverState,
  mockShowdownState,
  mockLegalActions,
} from '../components/__mock__/mockState';
import type { GameState, LegalActions } from '../engine/types';
import styles from '../App.module.css';

function getFixture(): { state: GameState; legalActions: LegalActions | null } {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('state') ?? 'river';
  switch (name) {
    case 'preflop':  return { state: mockPreflopState,  legalActions: mockLegalActions };
    case 'river':    return { state: mockRiverState,    legalActions: mockLegalActions };
    case 'showdown': return { state: mockShowdownState, legalActions: null };
    default:         return { state: mockState,         legalActions: mockLegalActions };
  }
}

function LayoutPreview() {
  const { state, legalActions } = getFixture();

  return (
    <div className={styles.viewport}>
      <div className={styles.railOuter}>
        <div className={styles.railInner}>
          <Table
            state={state}
            heroIndex={0}
            legalActions={legalActions}
            onAction={() => {}}
            reducedMotion={false}
          />
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');
createRoot(root).render(<LayoutPreview />);
