import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Note for `shadcn add`: the CLI currently writes `import { cn } from "cn"`
// into new components and installs the `cn` package. Point those imports at
// "@/lib/utils" instead and remove the package, so there is one helper.
