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
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import type { EventRow } from '@/server/events';
import { addGuest } from '@/server/event-guests';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  partySize: 1,
  note: '',
};

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
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => addGuest({ data: { eventId: event.id, ...values } }), {
      success: (r) => ({
        title: 'Guest added',
        description: `Booking ${r.reference}. HubSpot sends their emails once it is connected.`,
      }),
      error: 'Could not add the guest',
    });
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
        <form noValidate onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-first">First name</Label>
              <Input
                id="g-first"
                required
                maxLength={60}
                autoComplete="off"
                value={values.firstName}
                onChange={(e) => patch({ firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-last">Last name</Label>
              <Input
                id="g-last"
                maxLength={60}
                autoComplete="off"
                value={values.lastName}
                onChange={(e) => patch({ lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input
                id="g-email"
                type="email"
                maxLength={200}
                autoComplete="off"
                value={values.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-party">People</Label>
              <Input
                id="g-party"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={50}
                value={values.partySize}
                onChange={(e) =>
                  patch({ partySize: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-phone">Phone</Label>
            <Input
              id="g-phone"
              type="tel"
              maxLength={40}
              autoComplete="off"
              value={values.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-note">Note</Label>
            <Textarea
              id="g-note"
              rows={2}
              maxLength={500}
              value={values.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Accessibility or dietary needs"
            />
          </div>
          <DialogFooter>
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
