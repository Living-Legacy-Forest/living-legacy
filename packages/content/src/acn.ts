// Australian Company Numbers: 9 digits, the last a check digit (see ASIC's ACN format).
// Shown grouped 3-3-3, e.g. "000 000 019".

/** True for a well-formed ACN, ignoring spaces. */
export function isValidAcn(value: string): boolean {
  const digits = value.replace(/\s/g, '');
  if (!/^\d{9}$/.test(digits)) return false;
  const sum = [...digits.slice(0, 8)].reduce((total, d, i) => total + Number(d) * (8 - i), 0);
  return (10 - (sum % 10)) % 10 === Number(digits[8]);
}

/** "000000019" → "000 000 019". Anything that is not 9 digits is returned as typed. */
export function formatAcn(value: string): string {
  const digits = value.replace(/\s/g, '');
  if (!/^\d{9}$/.test(digits)) return value.trim();
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
