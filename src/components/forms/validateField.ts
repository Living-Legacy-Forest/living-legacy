/**
 * Per-field validity check for a controlled text input or textarea, ported
 * from the old DOM-wide validateForm() in src/lib/forms.ts so each React
 * form can run it against one field's ref and current value at a time.
 */
import { isBlankAfterTrim, isValidName } from '@/lib/forms';

export function isTextFieldValid(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  options: { isName?: boolean } = {}
): boolean {
  // Native constraints first: required, and type="email" format.
  if (el && !el.checkValidity()) return false;

  // checkValidity() passes "   " because the raw string is not empty, but
  // the payload builders trim it and HubSpot receives an empty property. A
  // value that trims away is the empty value, so treat it as one here.
  // Applies to every text field, not just names.
  if (isBlankAfterTrim(value)) return false;

  // Only given-name / family-name / name fields are checked for shape, and
  // only once filled in: an empty optional name field is not this check's
  // problem, `required` (via checkValidity above) already covers that.
  if (options.isName) {
    const trimmed = value.trim();
    if (trimmed !== '' && !isValidName(trimmed)) return false;
  }

  return true;
}
