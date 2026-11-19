import { z } from 'zod';

/**
 * A "rows a page" choice read from an address or a request: one of `sizes`, or left out, so the
 * usual size applies and a hand-edited `?rows=7` cannot ask for a page nobody offered.
 */
export const pageSizeParam = <S extends readonly number[]>(sizes: S) =>
  z
    .number()
    .refine((n): n is S[number] => sizes.includes(n))
    .optional()
    .catch(undefined);
