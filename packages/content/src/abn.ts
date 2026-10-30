// Australian Business Numbers: 11 digits with a checksum (see the ATO's ABN
// format). Shown grouped 2-3-3-3, e.g. "59 639 330 617".

const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** True for a well-formed ABN, ignoring spaces. */
export function isValidAbn(value: string): boolean {
  const digits = value.replace(/\s/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const sum = [...digits].reduce(
    (total, digit, i) => total + (Number(digit) - (i === 0 ? 1 : 0)) * WEIGHTS[i]!,
    0
  );
  return sum % 89 === 0;
}

/** "59639330617" → "59 639 330 617". Anything that is not 11 digits is returned as typed. */
export function formatAbn(value: string): string {
  const digits = value.replace(/\s/g, '');
  if (!/^\d{11}$/.test(digits)) return value.trim();
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
