/**
 * The "register interest for locations throughout Australia" form. Every
 * field, label, required marker and option list carried from the old Astro
 * + DOM version, including the "Other location" field that only appears
 * (and only becomes required) once "Other" is chosen.
 */
import { useEffect, useRef, useState } from 'react';
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
import {
  buildUpcomingLocationPayload,
  readHubSpotCookie,
  type UpcomingLocationFields,
} from '@/lib/forms';
import { FormFallbackAlert } from './FormFallbackAlert';
import { HoneypotField, useHoneypot } from './honeypot';
import { useHubspotSubmit } from './useHubspotSubmit';
import { isTextFieldValid } from './validateField';

const EMPTY_FIELDS: UpcomingLocationFields = {
  name: '',
  email: '',
  location: '',
  otherLocation: '',
  reason: '',
};

const AREAS = [
  'New South Wales (NSW)',
  'Victoria (VIC)',
  'Queensland (QLD)',
  'South Australia (SA)',
  'Western Australia (WA)',
  'Tasmania (TAS)',
  'Northern Territory (NT)',
  'Australian Capital Territory (ACT)',
  'Other',
];

type ValidatedField = 'name' | 'email' | 'otherLocation' | 'reason';
const TEXT_FIELD_ORDER: ValidatedField[] = ['name', 'email', 'otherLocation', 'reason'];

export function UpcomingLocationForm() {
  const [fields, setFields] = useState<UpcomingLocationFields>(EMPTY_FIELDS);
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<ValidatedField | 'location'>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const { honeypotRef, failsBotCheck } = useHoneypot();
  const fallbackRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const otherLocationRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const locationTriggerRef = useRef<HTMLButtonElement>(null);

  const focusField: Record<ValidatedField, () => void> = {
    name: () => nameRef.current?.focus(),
    email: () => emailRef.current?.focus(),
    otherLocation: () => otherLocationRef.current?.focus(),
    reason: () => reasonRef.current?.focus(),
  };

  const hubspotSubmit = useHubspotSubmit({
    formKey: 'upcomingLocation',
    successType: 'interest',
    toastMessage: "We couldn't register your interest. Please call or email us instead.",
  });

  useEffect(() => {
    if (hubspotSubmit.fallbackVisible) {
      fallbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hubspotSubmit.fallbackVisible]);

  function setField<K extends keyof UpcomingLocationFields>(name: K, value: string): void {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleLocationChange(value: string | null): void {
    const next = value ?? '';
    setFields((prev) => ({
      ...prev,
      location: next,
      otherLocation: next === 'Other' ? prev.otherLocation : '',
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (hubspotSubmit.sending) return;

    setFormError(null);
    hubspotSubmit.hideFallback();

    if (failsBotCheck()) {
      hubspotSubmit.showFallback();
      return;
    }

    const nextInvalid = new Set<ValidatedField | 'location'>();
    if (!isTextFieldValid(nameRef.current, fields.name, { isName: true })) nextInvalid.add('name');
    if (!isTextFieldValid(emailRef.current, fields.email)) nextInvalid.add('email');
    if (fields.location.trim() === '') nextInvalid.add('location');
    if (
      fields.location === 'Other' &&
      !isTextFieldValid(otherLocationRef.current, fields.otherLocation)
    ) {
      nextInvalid.add('otherLocation');
    }
    if (!isTextFieldValid(reasonRef.current, fields.reason)) nextInvalid.add('reason');

    setInvalid(nextInvalid);

    if (nextInvalid.size > 0) {
      setFormError('Please check the highlighted fields and try again.');
      if (nextInvalid.has('name')) {
        nameRef.current?.focus();
      } else if (nextInvalid.has('email')) {
        emailRef.current?.focus();
      } else if (nextInvalid.has('location')) {
        locationTriggerRef.current?.focus();
      } else {
        const firstInvalidName = TEXT_FIELD_ORDER.find((name) => nextInvalid.has(name));
        if (firstInvalidName) focusField[firstInvalidName]();
      }
      return;
    }

    if (!consent) {
      setFormError('Please agree to the privacy policy to continue.');
      return;
    }

    const payload = buildUpcomingLocationPayload(fields, {
      pageUri: window.location.href,
      pageName: document.title,
      hutk: readHubSpotCookie(document.cookie),
    });

    await hubspotSubmit.submit(payload);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={invalid.has('name') || undefined}>
            <FieldLabel htmlFor="upcoming-name">
              Name{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="upcoming-name"
              ref={nameRef}
              type="text"
              autoComplete="name"
              required
              value={fields.name}
              onChange={(e) => setField('name', e.target.value)}
              aria-invalid={invalid.has('name') || undefined}
            />
          </Field>
          <Field data-invalid={invalid.has('email') || undefined}>
            <FieldLabel htmlFor="upcoming-email">
              Email{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="upcoming-email"
              ref={emailRef}
              type="email"
              autoComplete="email"
              required
              value={fields.email}
              onChange={(e) => setField('email', e.target.value)}
              aria-invalid={invalid.has('email') || undefined}
            />
          </Field>
          <Field data-invalid={invalid.has('location') || undefined}>
            <FieldLabel htmlFor="upcoming-location">
              Which part of Australia are you located in{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Select
              value={fields.location === '' ? null : fields.location}
              onValueChange={(value) => handleLocationChange(value)}
              name="location"
              required
            >
              <SelectTrigger
                id="upcoming-location"
                ref={locationTriggerRef}
                className="w-full"
                aria-invalid={invalid.has('location') || undefined}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {fields.location === 'Other' && (
            <Field data-invalid={invalid.has('otherLocation') || undefined}>
              <FieldLabel htmlFor="upcoming-otherLocation">
                Other location{' '}
                <span className="text-moss-deep" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Input
                id="upcoming-otherLocation"
                ref={otherLocationRef}
                type="text"
                required
                value={fields.otherLocation}
                onChange={(e) => setField('otherLocation', e.target.value)}
                aria-invalid={invalid.has('otherLocation') || undefined}
              />
            </Field>
          )}
          <Field data-invalid={invalid.has('reason') || undefined}>
            <FieldLabel htmlFor="upcoming-reason">
              Why did you choose this area for a Living Legacy Forest?
            </FieldLabel>
            <Textarea
              id="upcoming-reason"
              ref={reasonRef}
              rows={4}
              placeholder="Please include any additional message..."
              value={fields.reason}
              onChange={(e) => setField('reason', e.target.value)}
              aria-invalid={invalid.has('reason') || undefined}
            />
          </Field>

          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="upcoming-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
            />
            <FieldLabel htmlFor="upcoming-consent" className="text-base font-normal">
              I have read and agree to the{' '}
              <a
                href="/privacy/"
                target="_blank"
                rel="noopener"
                className="text-ink hover:text-moss-deep underline underline-offset-2"
              >
                privacy policy
              </a>
              .{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
          </Field>

          {formError && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-destructive text-base font-medium"
            >
              {formError}
            </p>
          )}

          <div>
            <Button
              type="submit"
              disabled={hubspotSubmit.sending}
              className="w-full justify-center sm:w-auto"
            >
              {hubspotSubmit.sending ? 'Sending…' : 'Register interest'}
            </Button>
          </div>
        </FieldGroup>

        <HoneypotField ref={honeypotRef} />
      </form>

      {hubspotSubmit.fallbackVisible && (
        <div className="mt-6">
          <FormFallbackAlert ref={fallbackRef} />
        </div>
      )}
    </div>
  );
}
