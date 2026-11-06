import { STAFF_MAX_PARTY_SIZE, auPhone, guestInputSchema } from '@ll/content';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import type { EventRow } from '@/server/events';
import { addGuest } from '@/server/event-guests';
import { TOUCH_FIELDS } from './event-form';

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
  const patch = (next: Partial<typeof empty>) => setValues((v) => ({ ...v, ...next }));
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = firstProblem(event.id, values);
    if (problem) {
      const { id, label } = FIELDS[problem.field];
      const missing = values[problem.field] === '';
      notify.error(missing ? `${label} is required` : `${label} is not valid`, problem.message);
      document.getElementById(id)?.focus();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a guest</DialogTitle>
          <DialogDescription>A phone booking or a walk-in for {event.title}.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className={cn('space-y-4', TOUCH_FIELDS)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={FIELDS.firstName.id}>First name</Label>
              <Input
                id={FIELDS.firstName.id}
                value={values.firstName}
                required
                maxLength={60}
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="First name"
                onChange={(e) => patch({ firstName: onlyName(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={FIELDS.lastName.id}>Last name (optional)</Label>
              <Input
                id={FIELDS.lastName.id}
                value={values.lastName}
                maxLength={60}
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="Last name"
                onChange={(e) => patch({ lastName: onlyName(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor={FIELDS.email.id}>Email (optional)</Label>
              <Input
                id={FIELDS.email.id}
                value={values.email}
                type="email"
                maxLength={200}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="name@example.com"
                onChange={(e) => patch({ email: e.target.value.replace(/\s/g, '') })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={FIELDS.partySize.id}>People</Label>
              <Input
                id={FIELDS.partySize.id}
                value={values.partySize}
                inputMode="numeric"
                required
                maxLength={String(STAFF_MAX_PARTY_SIZE).length}
                placeholder="1"
                onChange={(e) => patch({ partySize: onlyDigits(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={FIELDS.phone.id}>Phone (optional)</Label>
            <Input
              id={FIELDS.phone.id}
              value={values.phone}
              type="tel"
              maxLength={20}
              autoComplete="off"
              placeholder="0400 000 000"
              onChange={(e) => patch({ phone: onlyPhone(e.target.value) })}
              onBlur={() => {
                // Shown as it will be saved, however it was typed.
                const tidy = auPhone(values.phone);
                if (tidy) patch({ phone: tidy });
              }}
            />
            <p className="text-muted-foreground text-xs">Australian mobile or landline.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={FIELDS.note.id}>Note (optional)</Label>
            <Textarea
              id={FIELDS.note.id}
              rows={2}
              maxLength={500}
              value={values.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Accessibility or dietary needs"
            />
          </div>
          <DialogFooter className="touch:*:min-h-11 flex-row max-sm:*:flex-1">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
