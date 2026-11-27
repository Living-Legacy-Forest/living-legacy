import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

// Addresses and links are not words: the keyboard should not capitalise, correct or spell-check them.
const ADDRESS_HINTS = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

// What a phone number is written with: digits, spaces, and + ( ) - . Nothing else is typed or pasted.
const NOT_PHONE = /[^\d\s+().-]/g;

function Input({ className, type, onChange, ...props }: React.ComponentProps<'input'>) {
  const phone = type === 'tel';
  return (
    <InputPrimitive
      type={type}
      {...(type === 'email' || type === 'url' ? ADDRESS_HINTS : null)}
      {...(phone ? { inputMode: 'tel' as const } : null)}
      onChange={
        phone
          ? (event) => {
              // Cleaned before the form reads it, so letters never reach the field's value.
              event.target.value = event.target.value.replace(NOT_PHONE, '');
              onChange?.(event);
            }
          : onChange
      }
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring/15 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-foreground/6 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/25 md:text-ui touch:h-9 bg-muted/60 h-8 w-full min-w-0 rounded-lg border border-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
