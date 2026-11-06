/**
 * An Australian mobile or landline in one format ("0412 345 678", "03 7019 6142"),
 * or null if it is not one. Takes the ways people write them, with or without +61.
 * Business numbers (13, 1300, 1800) are refused: they do not reach a person.
 */
export function auPhone(text: string): string | null {
  const compact = text.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  const n = compact.replace(/^\+?610?/, '0');
  if (/^04\d{8}$/.test(n)) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(n)) return `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`;
  return null;
}
