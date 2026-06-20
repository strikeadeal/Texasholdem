/**
 * RaiseControl — slider / input for sizing a bet or raise.
 * TODO: implement in step 4 (wiring agent).
 */
import React from 'react';

interface RaiseControlProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

export function RaiseControl({ min, max, value, onChange }: RaiseControlProps) {
  void min; void max; void value; void onChange;
  return <div data-component="RaiseControl" />;
}
