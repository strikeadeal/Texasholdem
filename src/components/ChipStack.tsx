/**
 * ChipStack — SVG chip stack for bets and pot display.
 * Denominations map to the palette:
 *   $1=ivory, $5=oxblood, $25=felt-green, $100=charcoal, $500=brass
 */
import React from 'react';
import styles from './ChipStack.module.css';

export interface ChipStackProps {
  amount: number;
  label?: string;
  prominent?: boolean;
  /** Max chips to render visually (default 6) */
  maxChips?: number;
}

interface ChipDenom {
  value: number;
  fill: string;
  stripe: string;
  label: string;
}

const DENOMS: ChipDenom[] = [
  { value: 500, fill: '#B89154', stripe: '#E6C77E', label: '500' },
  { value: 100, fill: '#3A3A3A', stripe: '#6A6A6A', label: '100' },
  { value:  25, fill: '#1E3A2B', stripe: '#4A7A56', label: '25'  },
  { value:   5, fill: '#9C2A24', stripe: '#D45A54', label: '5'   },
  { value:   1, fill: '#F0E8D4', stripe: '#B8A878', label: '1'   },
];

function breakAmount(amount: number): ChipDenom[] {
  let remaining = Math.max(0, Math.round(amount));
  const result: ChipDenom[] = [];
  for (const denom of DENOMS) {
    while (remaining >= denom.value && result.length < 8) {
      result.push(denom);
      remaining -= denom.value;
    }
  }
  return result;
}

interface SingleChipProps {
  fill: string;
  stripe: string;
  size?: number;
  offsetY?: number;
}

function SingleChip({ fill, stripe, size = 22, offsetY = 0 }: SingleChipProps) {
  const r = size / 2;
  const cy = r - offsetY;
  return (
    <svg
      width={size}
      height={size + 4}
      viewBox={`0 0 ${size} ${size + 4}`}
      overflow="visible"
      aria-hidden="true"
    >
      {/* Shadow / edge */}
      <ellipse cx={r} cy={cy + 3} rx={r - 1} ry={2.5} fill="rgba(0,0,0,0.45)" />
      {/* Chip body */}
      <circle cx={r} cy={cy} r={r - 1} fill={fill} />
      {/* Edge stripes (4 pairs) */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const sx = r + (r - 2) * Math.cos(rad);
        const sy = cy + (r - 2) * Math.sin(rad);
        return (
          <g key={angle}>
            <line
              x1={r + (r - 5) * Math.cos(rad)}
              y1={cy + (r - 5) * Math.sin(rad)}
              x2={sx}
              y2={sy}
              stroke={stripe}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* Top highlight arc */}
      <path
        d={`M ${r * 0.35} ${cy - r * 0.6} A ${r * 0.5} ${r * 0.3} 0 0 1 ${r * 0.65} ${cy - r * 0.6}`}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Inner rim */}
      <circle cx={r} cy={cy} r={r - 4} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
    </svg>
  );
}

function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function ChipStack({ amount, label, prominent = false, maxChips = 6 }: ChipStackProps) {
  const chips = breakAmount(amount).slice(0, maxChips);

  return (
    <div className={styles.stack}>
      {/* Visual chip stack: chips offset upward to fake 3D stacking */}
      <div className={styles.chips} style={{ height: chips.length > 0 ? 26 + chips.length * 3 : 0, width: chips.length > 0 ? 22 + chips.length * 2 : 0, position: 'relative' }}>
        {chips.map((chip, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: i * 3,
              left: i * 2,
              zIndex: i,
            }}
          >
            <SingleChip fill={chip.fill} stripe={chip.stripe} size={22} />
          </div>
        ))}
        {chips.length === 0 && null}
      </div>

      {/* Numeric label */}
      {amount > 0 && (
        <span className={`${styles.amount} ${prominent ? styles.prominent : ''}`}>
          {label ?? formatAmount(amount)}
        </span>
      )}
    </div>
  );
}
