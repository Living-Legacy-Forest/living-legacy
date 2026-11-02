/**
 * The panel every form on the site shows when it cannot submit, either
 * because its HubSpot GUID is not yet configured or because the request
 * failed. The form itself stays on screen behind it with every value the
 * visitor typed still in place; this never replaces the form.
 */
import { telHref } from '@llf/content';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FallbackContact } from '@/lib/forms';

export function FormFallbackAlert({
  contact,
  ref,
}: {
  contact: FallbackContact;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const phone = contact.phone && <a href={telHref(contact.phone)}>{contact.phone}</a>;
  const email = contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>;

  return (
    <Alert ref={ref} variant="destructive" tabIndex={-1}>
      <AlertTitle>We could not send that just now.</AlertTitle>
      <AlertDescription>
        {phone || email ? (
          <>
            Please {phone && <>call {phone}</>}
            {phone && email && ' or '}
            {email && <>email {email}</>} and we will come straight back to you.
          </>
        ) : (
          'Please try again in a little while.'
        )}{' '}
        Your details above have been kept.
      </AlertDescription>
    </Alert>
  );
}
