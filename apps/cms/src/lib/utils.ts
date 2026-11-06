import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The theme's own font sizes (styles.css), so `text-ui` is merged as a size
// and doesn't knock out a text colour such as `text-primary-foreground`.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['ui', 'ui-sm'] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
