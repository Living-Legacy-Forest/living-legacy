import { STAFF_MAX_PARTY_SIZE, auPhone, guestInputSchema } from '@ll/content';
import { useState } from 'react';
import { TOUCH_FIELDS } from '@/components/form-steps';
import { FormCell, FormSection } from '@/components/form-cells';
import { DialogActions, ListDialog } from '@/components/list/list-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import type { EventRow } from '@/server/events';
import { addGuest } from '@/server/event-guests';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  /** As typed, so it can be cleared on the way to another number. */
  partySize: '1',
  note: '',
};
type Field = keyof typeof empty;

// What each field can hold at all. What is typed is then checked by the shared
// rules (guestInputSchema), which the server applies too.
const onlyName = (text: string) => text.replace(/[^\p{L}\p{M}' ’.-]/gu, '');
const onlyPhone = (text: string) => text.replace(/[^\d+() .-]/g, '');
const onlyDigits = (text: string) => text.replace(/\D/g, '');

// These are someone else's details, so the browser must not offer the editor's
// own. Browsers ignore autocomplete="off" on name and contact fields but leave
// a field alone when the token is one they do not recognise.
const NO_AUTOFILL = 'off-guest';

/** Top to bottom, so the first problem is the one reported. */
const FIELDS: Record<Field, { id: string; label: string }> = {
  firstName: { id: 'g-first', label: 'First name' },
  lastName: { id: 'g-last', label: 'Last name' },
  email: { id: 'g-email', label: 'Email' },
  partySize: { id: 'g-party', label: 'Number of people' },
  phone: { id: 'g-phone', label: 'Phone' },
  note: { id: 'g-note', label: 'Note' },
};

/** The first thing wrong, as the form shows it, or null. */
function firstProblem(eventId: string, values: typeof empty) {
  const result = guestInputSchema.safeParse({
    eventId,
    ...values,
    partySize: Number(values.partySize || 0),
  });
  if (result.success) return null;
  for (const field of Object.keys(FIELDS) as Field[]) {
    const issue = result.error.issues.find((i) => i.path[0] === field);
    if (issue) return { field, message: issue.message };
  }
  return null;
}

/** A phone booking or a walk-in, added by staff. */
export function AddGuestDialog({
  event,
  open,
  onOpenChange,
  onAdded,
}: {
  event: EventRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState(empty);
  // The field to fix: named in a toast, as other forms do, and outlined until it is edited.
  const [problem, setProblem] = useState<{ field: Field; message: string } | null>(null);
  const patch = (next: Partial<typeof empty>) => {
    setValues((v) => ({ ...v, ...next }));
    // Typing in the field that was wrong clears its message.
    if (problem && problem.field in next) setProblem(null);
  };
  const invalid = (field: Field) => (problem?.field === field ? { 'aria-invalid': true } : {});
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = firstProblem(event.id, values);
    setProblem(found);
    if (found) {
      notify.error('Check the guest', found.message);
      document.getElementById(FIELDS[found.field].id)?.focus();
      return;
    }
    const result = await run(
      () =>
        addGuest({
          data: { eventId: event.id, ...values, partySize: Number(values.partySize) },
        }),
      {
        success: (r) => ({
          title: 'Guest added',
          description: `Booking ${r.reference}. HubSpot sends their emails once it is connected.`,
        }),
        error: 'Could not add the guest',
      }
    );
    if (result) {
      setValues(empty);
      onOpenChange(false);
      onAdded();
    }
  }

  return (
    <ListDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Add a guest"
      description={`A phone booking or a walk-in for ${event.title}.`}
    >
      <form noValidate onSubmit={submit} className={cn('space-y-4 max-md:space-y-7', TOUCH_FIELDS)}>
        <FormSection>
          <div className="grid grid-cols-2 gap-4 max-md:contents">
            <FormCell label="First name" htmlFor={FIELDS.firstName.id}>
              <Input
                id={FIELDS.firstName.id}
                {...invalid('firstName')}
                value={values.firstName}
                required
                maxLength={60}
                autoComplete={NO_AUTOFILL}
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="Required"
                onChange={(e) => patch({ firstName: onlyName(e.target.value) })}
              />
            </FormCell>
            <FormCell label="Last name (optional)" htmlFor={FIELDS.lastName.id}>
              <Input
                id={FIELDS.lastName.id}
                {...invalid('lastName')}
                value={values.lastName}
                maxLength={60}
                autoComplete={NO_AUTOFILL}
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                onChange={(e) => patch({ lastName: onlyName(e.target.value) })}
              />
            </FormCell>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-4 max-md:contents sm:grid-cols-[1fr_7rem]">
            <FormCell label="Email (optional)" htmlFor={FIELDS.email.id}>
              <Input
                id={FIELDS.email.id}
                {...invalid('email')}
                value={values.email}
                type="email"
                maxLength={200}
                autoComplete={NO_AUTOFILL}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="name@example.com"
                onChange={(e) => patch({ email: e.target.value.replace(/\s/g, '') })}
              />
            </FormCell>
            <FormCell label="People" htmlFor={FIELDS.partySize.id}>
              <Input
                id={FIELDS.partySize.id}
                {...invalid('partySize')}
                value={values.partySize}
                inputMode="numeric"
                required
                maxLength={String(STAFF_MAX_PARTY_SIZE).length}
                placeholder="1"
                onChange={(e) => patch({ partySize: onlyDigits(e.target.value) })}
              />
            </FormCell>
          </div>
          <FormCell
            label="Phone (optional)"
            htmlFor={FIELDS.phone.id}
            hint="Australian mobile or landline."
          >
            <Input
              id={FIELDS.phone.id}
              {...invalid('phone')}
              value={values.phone}
              type="tel"
              maxLength={20}
              autoComplete={NO_AUTOFILL}
              placeholder="0400 000 000"
              onChange={(e) => patch({ phone: onlyPhone(e.target.value) })}
              onBlur={() => {
                // Shown as it will be saved, however it was typed.
                const tidy = auPhone(values.phone);
                if (tidy) patch({ phone: tidy });
              }}
            />
          </FormCell>
        </FormSection>
        <FormSection>
          <FormCell label="Note (optional)" htmlFor={FIELDS.note.id}>
            <Textarea
              id={FIELDS.note.id}
              {...invalid('note')}
              rows={2}
              maxLength={500}
              value={values.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Accessibility or dietary needs"
            />
          </FormCell>
        </FormSection>
        <DialogActions>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner />
                Adding…
              </>
            ) : (
              'Add guest'
            )}
          </Button>
        </DialogActions>
      </form>
    </ListDialog>
  );
}
