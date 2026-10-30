/**
 * The "become a partner" form on /our-partners/. Every field, label,
 * required marker and option list carried from the old Astro + DOM version;
 * see ContactForm.tsx for the shared submission/validation pattern.
 */
import { useEffect, useRef, useState } from 'react';
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
import { buildPartnerPayload, readHubSpotCookie, type PartnerFields } from '@/lib/forms';
import { FormFallbackAlert } from './FormFallbackAlert';
import { HoneypotField, useHoneypot } from './honeypot';
import { useHubspotSubmit } from './useHubspotSubmit';
import { isTextFieldValid } from './validateField';

const EMPTY_FIELDS: PartnerFields = {
  firstName: '',
  companyName: '',
  email: '',
  phone: '',
  partnershipInterest: '',
  message: '',
};

const PARTNERSHIP_INTERESTS = [
  'Corporate social responsibility (CSR)',
  'Donation / sponsorship',
  'Memorial program partnership',
  'Eco-tourism collaboration',
  'Educational / institutional collaboration',
  'Land or tree adoption program',
  'Event partnership',
  'Other (please specify)',
];

type TextFieldName = 'firstName' | 'companyName' | 'email' | 'phone' | 'message';
const TEXT_FIELD_ORDER: TextFieldName[] = ['firstName', 'companyName', 'email', 'phone', 'message'];

export function PartnerForm() {
  const [fields, setFields] = useState<PartnerFields>(EMPTY_FIELDS);
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<TextFieldName>>(new Set());

  const { honeypotRef, failsBotCheck } = useHoneypot();
  const fallbackRef = useRef<HTMLDivElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const focusField: Record<TextFieldName, () => void> = {
    firstName: () => firstNameRef.current?.focus(),
    companyName: () => companyNameRef.current?.focus(),
    email: () => emailRef.current?.focus(),
    phone: () => phoneRef.current?.focus(),
    message: () => messageRef.current?.focus(),
  };

  const hubspotSubmit = useHubspotSubmit({
    formKey: 'partner',
    successType: 'partner',
    toastMessage: "We couldn't send your enquiry. Please call or email us instead.",
  });

  useEffect(() => {
    if (hubspotSubmit.fallbackVisible) {
      fallbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hubspotSubmit.fallbackVisible]);

  function setField<K extends keyof PartnerFields>(name: K, value: string): void {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (hubspotSubmit.sending) return;

    hubspotSubmit.hideFallback();

    if (failsBotCheck()) {
      hubspotSubmit.showFallback();
      return;
    }

    const nextInvalid = new Set<TextFieldName>();
    if (!isTextFieldValid(firstNameRef.current, fields.firstName, { isName: true })) {
      nextInvalid.add('firstName');
    }
    if (!isTextFieldValid(companyNameRef.current, fields.companyName))
      nextInvalid.add('companyName');
    if (!isTextFieldValid(emailRef.current, fields.email)) nextInvalid.add('email');
    if (!isTextFieldValid(phoneRef.current, fields.phone)) nextInvalid.add('phone');
    if (!isTextFieldValid(messageRef.current, fields.message)) nextInvalid.add('message');

    setInvalid(nextInvalid);

    if (nextInvalid.size > 0) {
      toast.error('Please check the highlighted fields and try again.');
      const firstInvalidName = TEXT_FIELD_ORDER.find((name) => nextInvalid.has(name));
      if (firstInvalidName) focusField[firstInvalidName]();
      return;
    }

    if (!consent) {
      toast.error('Please agree to the privacy policy to continue.');
      return;
    }

    const payload = buildPartnerPayload(fields, {
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
            <FieldLabel htmlFor="partner-firstName">
              First name{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="partner-firstName"
              ref={firstNameRef}
              type="text"
              autoComplete="given-name"
              required
              value={fields.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              aria-invalid={invalid.has('firstName') || undefined}
            />
          </Field>
          <Field data-invalid={invalid.has('companyName') || undefined}>
            <FieldLabel htmlFor="partner-companyName">
              Company name{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="partner-companyName"
              ref={companyNameRef}
              type="text"
              autoComplete="organization"
              required
              value={fields.companyName}
              onChange={(e) => setField('companyName', e.target.value)}
              aria-invalid={invalid.has('companyName') || undefined}
            />
          </Field>
          <Field data-invalid={invalid.has('email') || undefined}>
            <FieldLabel htmlFor="partner-email">
              Email{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="partner-email"
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
            <FieldLabel htmlFor="partner-phone">
              Phone{' '}
              <span className="text-moss-deep" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <Input
              id="partner-phone"
              ref={phoneRef}
              type="tel"
              autoComplete="tel"
              required
              value={fields.phone}
              onChange={(e) => setField('phone', e.target.value)}
              aria-invalid={invalid.has('phone') || undefined}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="partner-partnershipInterest">Partnership interest</FieldLabel>
            <Select
              value={fields.partnershipInterest === '' ? null : fields.partnershipInterest}
              onValueChange={(value) => setField('partnershipInterest', value ?? '')}
              name="partnershipInterest"
            >
              <SelectTrigger id="partner-partnershipInterest" className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PARTNERSHIP_INTERESTS.map((interest) => (
                    <SelectItem key={interest} value={interest}>
                      {interest}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="sm:col-span-2" data-invalid={invalid.has('message') || undefined}>
            <FieldLabel htmlFor="partner-message">Message</FieldLabel>
            <Textarea
              id="partner-message"
              ref={messageRef}
              rows={5}
              value={fields.message}
              onChange={(e) => setField('message', e.target.value)}
              aria-invalid={invalid.has('message') || undefined}
            />
          </Field>

          <Field orientation="horizontal" className="items-start gap-3 sm:col-span-2">
            <Checkbox
              id="partner-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
            />
            <FieldLabel htmlFor="partner-consent" className="text-ink-soft font-normal">
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

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={hubspotSubmit.sending}
              className="w-full justify-center sm:w-auto"
            >
              {hubspotSubmit.sending ? 'Sending…' : 'Become a partner'}
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
