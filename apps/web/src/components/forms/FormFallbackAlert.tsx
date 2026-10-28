/**
 * The panel every form on the site shows when it cannot submit, either
 * because its HubSpot GUID is not yet configured or because the request
 * failed. The form itself stays on screen behind it with every value the
 * visitor typed still in place; this never replaces the form.
 */
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FALLBACK_CONTACT } from '@/lib/forms';

export function FormFallbackAlert({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <Alert ref={ref} variant="destructive" tabIndex={-1}>
      <AlertTitle>We could not send that just now.</AlertTitle>
      <AlertDescription>
        Please call <a href={FALLBACK_CONTACT.phoneHref}>{FALLBACK_CONTACT.phone}</a> or email{' '}
        <a href={`mailto:${FALLBACK_CONTACT.email}`}>{FALLBACK_CONTACT.email}</a> and we will come
        straight back to you. Your details above have been kept.
      </AlertDescription>
    </Alert>
  );
}
