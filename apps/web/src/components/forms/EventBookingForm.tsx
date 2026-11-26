/**
 * The booking form on an event's page. It posts to /api/events/book, which hands the booking to
 * the CMS; the CMS decides whether there is room and answers with a reference and a link token.
 * On success the visitor lands on the manage page, which also serves as their thanks.
 * Follows ContactForm.tsx for fields and validation; it never claims a booking that was not made.
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trackLead } from '@/lib/analytics';
import { HoneypotField, useHoneypot } from './honeypot';
import { isTextFieldValid } from './validateField';

const GENERIC_FAILURE = 'We could not take your booking just now. Please try again, or call us.';

/** Statuses whose message is written for the visitor: not valid, no room, too many tries. */
const READABLE_STATUSES = [400, 409, 429];

type Answer = { ok?: boolean; message?: unknown; reference?: unknown; token?: unknown };

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', note: '' };
type FieldName = keyof typeof EMPTY;
const FIELD_ORDER: FieldName[] = ['firstName', 'lastName', 'email', 'phone', 'note'];

const required = (
  <span className="text-moss-deep" aria-hidden="true">
    *
  </span>
);

export function EventBookingForm({
  eventId,
  maxPartySize,
}: {
  eventId: string;
  maxPartySize: number;
}) {
  const [fields, setFields] = useState(EMPTY);
  const [partySize, setPartySize] = useState('1');
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<FieldName>>(new Set());
  const [sending, setSending] = useState(false);

  const { honeypotRef } = useHoneypot();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const refs = {
    firstName: firstNameRef,
    lastName: lastNameRef,
    email: emailRef,
    phone: phoneRef,
    note: noteRef,
  };

  const setField = (name: FieldName, value: string) =>
    setFields((prev) => ({ ...prev, [name]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sending) return;

    const nextInvalid = new Set<FieldName>();
    if (!isTextFieldValid(firstNameRef.current, fields.firstName, { isName: true })) {
      nextInvalid.add('firstName');
    }
    if (!isTextFieldValid(lastNameRef.current, fields.lastName, { isName: true })) {
      nextInvalid.add('lastName');
    }
    if (!isTextFieldValid(emailRef.current, fields.email)) nextInvalid.add('email');
    if (!isTextFieldValid(phoneRef.current, fields.phone)) nextInvalid.add('phone');
    if (!isTextFieldValid(noteRef.current, fields.note)) nextInvalid.add('note');
    setInvalid(nextInvalid);

    if (nextInvalid.size > 0) {
      toast.error('Please check the highlighted fields and try again.');
      const first = FIELD_ORDER.find((name) => nextInvalid.has(name));
      if (first) refs[first].current?.focus();
      return;
    }
    if (!consent) {
      toast.error('Please agree to the privacy policy to continue.');
      return;
    }

    setSending(true);
    let status = 0;
    let answer: Answer | null = null;
    try {
      const response = await fetch('/api/events/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email,
          phone: fields.phone,
          partySize: Number(partySize),
          note: fields.note,
          consent: true,
          // The honeypot's value goes along, so the server refuses a bot with its plain answer;
          // a person's form always sends it empty.
          company: honeypotRef.current?.value ?? '',
        }),
      });
      status = response.status;
      answer = (await response.json()) as Answer;
    } catch {
      // A network or JSON failure reads as the generic message below.
    }

    if (
      status >= 200 &&
      status < 300 &&
      answer?.ok === true &&
      typeof answer.reference === 'string' &&
      typeof answer.token === 'string'
    ) {
      // No names, emails or phone numbers: the lead event carries only the form type.
      await trackLead('event_rsvp');
      const query = new URLSearchParams({ ref: answer.reference, token: answer.token, new: '1' });
      window.location.assign(`/events/manage/?${query.toString()}`);
      return;
    }

    // What was typed stays in place whatever went wrong.
    toast.error(
      READABLE_STATUSES.includes(status) && typeof answer?.message === 'string' && answer.message
        ? answer.message
        : GENERIC_FAILURE
    );
    setSending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field data-invalid={invalid.has('firstName') || undefined}>
          <FieldLabel htmlFor="event-firstName">First name {required}</FieldLabel>
          <Input
            id="event-firstName"
            ref={firstNameRef}
            type="text"
            autoComplete="given-name"
            required
            value={fields.firstName}
            onChange={(e) => setField('firstName', e.target.value)}
            aria-invalid={invalid.has('firstName') || undefined}
          />
        </Field>
        <Field data-invalid={invalid.has('lastName') || undefined}>
          <FieldLabel htmlFor="event-lastName">Last name</FieldLabel>
          <Input
            id="event-lastName"
            ref={lastNameRef}
            type="text"
            autoComplete="family-name"
            value={fields.lastName}
            onChange={(e) => setField('lastName', e.target.value)}
            aria-invalid={invalid.has('lastName') || undefined}
          />
        </Field>
        <Field className="sm:col-span-2" data-invalid={invalid.has('email') || undefined}>
          <FieldLabel htmlFor="event-email">Email {required}</FieldLabel>
          <Input
            id="event-email"
            ref={emailRef}
            type="email"
            autoComplete="email"
            required
            value={fields.email}
            onChange={(e) => setField('email', e.target.value)}
            aria-invalid={invalid.has('email') || undefined}
          />
        </Field>
        <Field data-invalid={invalid.has('phone') || undefined}>
          <FieldLabel htmlFor="event-phone">Phone</FieldLabel>
          <Input
            id="event-phone"
            ref={phoneRef}
            type="tel"
            autoComplete="tel"
            value={fields.phone}
            onChange={(e) => setField('phone', e.target.value)}
            aria-invalid={invalid.has('phone') || undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="event-partySize">People</FieldLabel>
          <Select value={partySize} onValueChange={(value) => setPartySize(value ?? '1')}>
            <SelectTrigger id="event-partySize" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Array.from({ length: Math.max(1, maxPartySize) }, (_, i) => String(i + 1)).map(
                  (count) => (
                    <SelectItem key={count} value={count}>
                      {count}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="sm:col-span-2" data-invalid={invalid.has('note') || undefined}>
          <FieldLabel htmlFor="event-note">Accessibility or dietary needs</FieldLabel>
          <Textarea
            id="event-note"
            ref={noteRef}
            rows={3}
            value={fields.note}
            onChange={(e) => setField('note', e.target.value)}
            aria-invalid={invalid.has('note') || undefined}
          />
        </Field>

        <Field orientation="horizontal" className="items-start gap-3 sm:col-span-2">
          <Checkbox
            id="event-consent"
            required
            aria-required
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <FieldLabel htmlFor="event-consent" className="text-ink-soft font-normal">
            I have read and agree to the{' '}
            <a
              href="/privacy/"
              target="_blank"
              rel="noopener"
              className="text-ink hover:text-moss-deep underline underline-offset-2"
            >
              privacy policy
            </a>
            . {required}
          </FieldLabel>
        </Field>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={sending} className="w-full justify-center sm:w-auto">
            {sending ? 'Booking…' : 'Book my place'}
          </Button>
        </div>
      </FieldGroup>

      <HoneypotField ref={honeypotRef} />
    </form>
  );
}
