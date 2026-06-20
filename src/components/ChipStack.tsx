/**
 * ChipStack — renders a visual stack of chips for a given amount.
 * TODO: implement in step 3 (visual components agent).
 */
import React from 'react';

interface ChipStackProps {
  amount: number;
  label?: string;
}

export function ChipStack({ amount, label }: ChipStackProps) {
  void amount; void label;
  return <div data-component="ChipStack" />;
}
