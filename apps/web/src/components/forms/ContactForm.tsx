/**
 * The /contact/ form. Every field, label, required marker and behaviour
 * carried from the old Astro + DOM version: honeypot kept, HubSpot payload
 * built from src/lib/forms.ts's pure builder, and a submission that never
 * claims success unless HubSpot actually accepted it.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildContactPayload, readHubSpotCookie, type ContactFields } from '@/lib/forms';
import { FormFallbackAlert } from './FormFallbackAlert';
import { HoneypotField, useHoneypot } from './honeypot';
import { useHubspotSubmit } from './useHubspotSubmit';
import { isTextFieldValid } from './validateField';

const EMPTY_FIELDS: ContactFields = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
};

type FieldName = keyof ContactFields;
const FIELD_ORDER: FieldName[] = ['firstName', 'lastName', 'email', 'phone', 'message'];

export function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(EMPTY_FIELDS);
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<FieldName>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const { honeypotRef, failsBotCheck } = useHoneypot();
  const fallbackRef = useRef<HTMLDivElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const focusField: Record<FieldName, () => void> = {
    firstName: () => firstNameRef.current?.focus(),
    lastName: () => lastNameRef.current?.focus(),
    email: () => emailRef.current?.focus(),
    phone: () => phoneRef.current?.focus(),
    message: () => messageRef.current?.focus(),
  };

  const hubspotSubmit = useHubspotSubmit({
    formKey: 'contact',
    successType: 'contact',
    toastMessage: "We couldn't send your message. Please call or email us instead.",
  });

  useEffect(() => {
    if (hubspotSubmit.fallbackVisible) {
      fallbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hubspotSubmit.fallbackVisible]);

  function setField<K extends FieldName>(name: K, value: string): void {
    setFields((prev) => ({ ...prev, [name]: value }));
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

    const nextInvalid = new Set<FieldName>();
    if (!isTextFieldValid(firstNameRef.current, fields.firstName, { isName: true })) {
      nextInvalid.add('firstName');
    }
    if (!isTextFieldValid(lastNameRef.current, fields.lastName, { isName: true })) {
      nextInvalid.add('lastName');
    }
    if (!isTextFieldValid(emailRef.current, fields.email)) nextInvalid.add('email');
    if (!isTextFieldValid(phoneRef.current, fields.phone)) nextInvalid.add('phone');
    if (!isTextFieldValid(messageRef.current, fields.message)) nextInvalid.add('message');

    setInvalid(nextInvalid);

    if (nextInvalid.size > 0) {
      setFormError('Please check the highlighted fields and try again.');
      const firstInvalidName = FIELD_ORDER.find((name) => nextInvalid.has(name));
      if (firstInvalidName) focusField[firstInvalidName]();
      return;
    }

    if (!consent) {
      setFormError('Please agree to the privacy policy to continue.');
      return;
    }

    const payload = buildContactPayload(fields, {
      pageUri: window.location.href,
      pageName: document.title,
      hutk: readHubSpotCookie(document.cookie),
    });

    await hubspotSubmit.submit(payload);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={invalid.has('firstName') || undefined}>
            <FieldLabel htmlFor="contact-firstName">
              First name{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="contact-firstName"
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
            <FieldLabel htmlFor="contact-lastName">Last name</FieldLabel>
            <Input
              id="contact-lastName"
              ref={lastNameRef}
              type="text"
              autoComplete="family-name"
              value={fields.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              aria-invalid={invalid.has('lastName') || undefined}
            />
          </Field>
          <Field className="sm:col-span-2" data-invalid={invalid.has('email') || undefined}>
            <FieldLabel htmlFor="contact-email">
              Email{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="contact-email"
              ref={emailRef}
              type="email"
              autoComplete="email"
              required
              value={fields.email}
              onChange={(e) => setField('email', e.target.value)}
              aria-invalid={invalid.has('email') || undefined}
            />
          </Field>
          <Field className="sm:col-span-2" data-invalid={invalid.has('phone') || undefined}>
            <FieldLabel htmlFor="contact-phone">
              Phone{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="contact-phone"
              ref={phoneRef}
              type="tel"
              autoComplete="tel"
              required
              value={fields.phone}
              onChange={(e) => setField('phone', e.target.value)}
              aria-invalid={invalid.has('phone') || undefined}
            />
          </Field>
          <Field className="sm:col-span-2" data-invalid={invalid.has('message') || undefined}>
            <FieldLabel htmlFor="contact-message">Message</FieldLabel>
            <Textarea
              id="contact-message"
              ref={messageRef}
              rows={5}
              value={fields.message}
              onChange={(e) => setField('message', e.target.value)}
              aria-invalid={invalid.has('message') || undefined}
            />
          </Field>

          <Field orientation="horizontal" className="items-start sm:col-span-2">
            <Checkbox
              id="contact-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
            />
            <FieldLabel htmlFor="contact-consent" className="text-base font-normal">
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
              className="text-destructive text-base font-medium sm:col-span-2"
            >
              {formError}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={hubspotSubmit.sending}
              className="w-full justify-center sm:w-auto"
            >
              {hubspotSubmit.sending ? 'Sending…' : 'Send message'}
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
