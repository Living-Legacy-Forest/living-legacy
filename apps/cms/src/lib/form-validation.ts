import { toast } from 'sonner';

/**
 * Checks a form's fields (required, type, pattern…) and reports the first problem
 * as a toast instead of the browser's own bubble. Pair it with `noValidate`.
 */
export function reportInvalid(form: EventTarget): boolean {
  if (!(form instanceof HTMLFormElement)) return true;

  for (const field of Array.from(form.elements)) {
    if (
      !(field instanceof HTMLInputElement) &&
      !(field instanceof HTMLTextAreaElement) &&
      !(field instanceof HTMLSelectElement)
    ) {
      continue;
    }
    if (field.validity.valid) continue;

    const label = field.labels?.[0]?.textContent?.trim() || 'This field';
    toast.error(field.validity.valueMissing ? `${label} is required.` : `${label} is not valid.`);
    field.focus();
    return false;
  }
  return true;
}
