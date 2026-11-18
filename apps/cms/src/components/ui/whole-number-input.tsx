import * as React from 'react';
import { Input } from '@/components/ui/input';

type WholeNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange' | 'min' | 'max'
> & {
  /** The digits as typed; empty when there is none. */
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
};

/**
 * A field for a whole number. Only digits can be typed or pasted (no "e", signs, decimal points
 * or spin buttons, which `type="number"` allows), the phone shows a number pad, and on leaving
 * the field a value outside `min` to `max` is brought into range. The server still checks it.
 */
export function WholeNumberInput({
  value,
  onValueChange,
  min,
  max,
  onBlur,
  ...props
}: WholeNumberInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={max === undefined ? undefined : String(max).length}
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
      onBlur={(e) => {
        const typed = e.target.value;
        if (typed !== '') {
          const n = Number(typed);
          const clamped = Math.min(max ?? n, Math.max(min ?? n, n));
          if (clamped !== n || typed !== String(n)) onValueChange(String(clamped));
        }
        onBlur?.(e);
      }}
    />
  );
}
