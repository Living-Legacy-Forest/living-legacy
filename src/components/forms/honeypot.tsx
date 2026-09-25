/**
 * The honeypot every form on the site carries: a hidden text field no human
 * will ever fill in. Ported from the old DOM version in src/lib/forms.ts
 * (installHoneypot / failsBotCheck) now that each form owns its own React
 * state and refs instead of a plain HTMLFormElement.
 *
 * Fail-open by design: a submission is only ever blocked when the field
 * comes back non-empty. Better a rare bot than a real family turned away.
 *
 * The name is deliberately meaningless. Anything like `company_website`
 * invites password managers to autofill it, which would block a real
 * person. `display:none` is the signal those extensions reliably skip; the
 * off-screen positioning is a second line of defence for anything that
 * ignores it.
 */
import { useRef } from 'react';

export function useHoneypot() {
  const honeypotRef = useRef<HTMLInputElement>(null);

  const failsBotCheck = (): boolean => (honeypotRef.current?.value.trim() ?? '') !== '';

  return { honeypotRef, failsBotCheck };
}

const HONEYPOT_STYLE = {
  display: 'none',
  position: 'absolute',
  left: '-9999px',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
} as const;

export function HoneypotField({ ref }: { ref: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      type="text"
      name="llf_trap_field"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={HONEYPOT_STYLE}
    />
  );
}
