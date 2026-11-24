import { notify } from './notify';

/**
 * Outlines the field in red until it is next edited, so the problem shows where the person is
 * looking as well as in the toast. A field whose own code sets aria-invalid is left to it.
 */
function markInvalid(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (field.hasAttribute('aria-invalid')) return;
  field.setAttribute('aria-invalid', 'true');
  const clear = () => {
    field.removeAttribute('aria-invalid');
    field.removeEventListener('input', clear);
    field.removeEventListener('change', clear);
  };
  field.addEventListener('input', clear);
  field.addEventListener('change', clear);
}

/**
 * Checks a form's fields (required, type, pattern…) and reports the first problem
 * as a toast instead of the browser's own bubble, with a red outline on the field.
 * Pair it with `noValidate`.
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
    notify.error(
      field.validity.valueMissing ? `${label} is required` : `${label} is not valid`,
      field.validity.valueMissing
        ? 'Fill it in, then try again.'
        : field.validationMessage || 'Check it, then try again.'
    );
    markInvalid(field);
    field.focus();
    return false;
  }
  return true;
}
