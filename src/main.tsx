import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts — bundled via @fontsource, no external CDN
import './styles/fonts';

// Global styles (tokens + reset)
import './styles/global.css';

import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
