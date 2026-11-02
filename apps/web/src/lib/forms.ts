/**
 * Shared form machinery: HubSpot payload builders, the submission endpoint,
 * and the pure validation helpers every form on the site shares. Every
 * export here is framework-agnostic (no DOM access), so it works the same
 * way inside the React form islands under src/components/forms/. The
 * DOM-only pieces this file used to carry (honeypot, native-form validation,
 * bind-once) now live alongside the React components that need them, since
 * a shadcn/React form owns its own field refs and state rather than
 * querying a plain HTMLFormElement.
 *
 * Modelled on the sibling forest site's src/lib/forms.ts, trimmed and
 * reshaped for the three forms this site actually has: contact, become a
 * partner and register interest in an upcoming location. Unlike the sibling
 * site, none of these forms carries a marketing opt-in checkbox, so the
 * consent block here is a single "I agree to the privacy policy" tick
 * rather than a pair of terms/marketing checkboxes.
 */

/** HubSpot identifiers. Portal and form GUIDs are unknown until the client
 *  supplies them; every value stays null until then. A form still renders
 *  and can still be filled in while its GUID is null, but submitting shows
 *  the phone/email fallback instead of pretending to succeed. See
 *  `isHubspotConfigured` and each page's submit handler. */
export const hubspot: {
  portalId: string | null;
  region: 'ap1' | 'na1';
  forms: {
    contact: string | null;
    partner: string | null;
    upcomingLocation: string | null;
  };
} = {
  portalId: import.meta.env.PUBLIC_HUBSPOT_PORTAL_ID ?? null,
  region: 'ap1',
  forms: {
    // TODO(client): HubSpot form GUID for the /contact/ form.
    contact: null,
    // TODO(client): HubSpot form GUID for the /our-partners/ "become a partner" form.
    partner: null,
    // TODO(client): HubSpot form GUID for the upcoming-locations register interest form.
    upcomingLocation: null,
  },
};

/** The consent wording sent to HubSpot and shown by FormConsent.astro. Kept
 *  as one string, since every form on this site has exactly one consent
 *  checkbox rather than a terms/marketing pair. */
export const CONSENT_TEXT = 'I have read and agree to the privacy policy.';

/** The phone and email shown when a form cannot be submitted, either
 *  because its HubSpot GUID is not yet configured or because the request
 *  failed. Each page passes them in from the CMS Settings page, so every form
 *  shows the same fallback. */
export interface FallbackContact {
  phone: string;
  email: string;
}

export interface PageContext {
  pageUri: string;
  pageName: string;
  hutk?: string;
}

export interface HubSpotPayload {
  fields: Array<{ name: string; value: string }>;
  context: PageContext;
  legalConsentOptions: {
    consent: {
      consentToProcess: boolean;
      text: string;
    };
  };
}

/** Everything the three payload builders have in common: trimming and the
 *  `legalConsentOptions` block. Each caller owns only its own field mapping. */
function buildPayload(
  fields: Array<{ name: string; value: string }>,
  ctx: PageContext
): HubSpotPayload {
  const context: PageContext = { pageUri: ctx.pageUri, pageName: ctx.pageName };
  // Assigned conditionally rather than as `hutk: ctx.hutk`, so the key is
  // genuinely absent instead of present-and-undefined.
  if (ctx.hutk) context.hutk = ctx.hutk;

  return {
    fields: fields.map((field) => ({ name: field.name, value: field.value.trim() })),
    context,
    legalConsentOptions: {
      consent: {
        // The consent checkbox is required, so a submission that reaches
        // here has always been agreed to. It is never sent as false.
        consentToProcess: true,
        text: CONSENT_TEXT,
      },
    },
  };
}

export interface ContactFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
}

/** Build the contact submission body. Every field maps onto a standard
 *  HubSpot contact property, so nothing needs folding into `message`. */
export function buildContactPayload(fields: ContactFields, ctx: PageContext): HubSpotPayload {
  return buildPayload(
    [
      { name: 'firstname', value: fields.firstName },
      { name: 'lastname', value: fields.lastName },
      { name: 'email', value: fields.email },
      { name: 'phone', value: fields.phone },
      { name: 'message', value: fields.message },
    ],
    ctx
  );
}

export interface PartnerFields {
  firstName: string;
  companyName: string;
  email: string;
  phone: string;
  partnershipInterest: string;
  message: string;
}

/** Fold the company name and the chosen partnership interest into the
 *  message body. Neither is a standard HubSpot contact property, and a
 *  custom one is not worth the risk: HubSpot rejects an entire submission
 *  with a 400 for any property the target form does not carry, so every new
 *  property is one more way for every partner enquiry to fail. */
function composePartnerMessage(
  companyName: string,
  partnershipInterest: string,
  message: string
): string {
  const lines: string[] = [];
  const company = companyName.trim();
  const interest = partnershipInterest.trim();
  const body = message.trim();

  if (company !== '') lines.push(`Company: ${company}`);
  if (interest !== '') lines.push(`Partnership interest: ${interest}`);

  const preamble = lines.join('\n');
  if (preamble === '') return body;
  return body === '' ? preamble : `${preamble}\n\n${body}`;
}

/** Build the become-a-partner submission body. First name, email and phone
 *  map onto standard properties; company name, partnership interest and the
 *  free-text message are combined into the one `message` property. */
export function buildPartnerPayload(fields: PartnerFields, ctx: PageContext): HubSpotPayload {
  return buildPayload(
    [
      { name: 'firstname', value: fields.firstName },
      { name: 'lastname', value: '' },
      { name: 'email', value: fields.email },
      { name: 'phone', value: fields.phone },
      {
        name: 'message',
        value: composePartnerMessage(
          fields.companyName,
          fields.partnershipInterest,
          fields.message
        ),
      },
    ],
    ctx
  );
}

export interface UpcomingLocationFields {
  name: string;
  email: string;
  /** One of the state/territory options, or "Other". */
  location: string;
  /** Only meaningful when `location` is "Other"; ignored otherwise. */
  otherLocation: string;
  reason: string;
}

/** Fold the chosen area (and, when relevant, the free-text "other" location)
 *  and the reason into the message body. Same reasoning as the partner
 *  form: HubSpot has no standard property for either, and a custom one
 *  risks every submission on this form rather than just this field. */
function composeUpcomingLocationMessage(
  location: string,
  otherLocation: string,
  reason: string
): string {
  const loc = location.trim();
  const other = otherLocation.trim();
  const body = reason.trim();

  const lines: string[] = [];
  if (loc !== '') {
    lines.push(`Area: ${loc === 'Other' && other !== '' ? `Other — ${other}` : loc}`);
  }

  const preamble = lines.join('\n');
  if (preamble === '') return body;
  return body === '' ? preamble : `${preamble}\n\n${body}`;
}

/** Build the upcoming-locations submission body. The visitor's name goes in
 *  full as `firstname`, since the form asks for one name field rather than
 *  first and last; the chosen area, any "other" detail and the reason are
 *  combined into `message`. */
export function buildUpcomingLocationPayload(
  fields: UpcomingLocationFields,
  ctx: PageContext
): HubSpotPayload {
  return buildPayload(
    [
      { name: 'firstname', value: fields.name },
      { name: 'lastname', value: '' },
      { name: 'email', value: fields.email },
      { name: 'phone', value: '' },
      {
        name: 'message',
        value: composeUpcomingLocationMessage(fields.location, fields.otherLocation, fields.reason),
      },
    ],
    ctx
  );
}

/** The HubSpot Forms API v3 submission host for each region. Both regions
 *  currently resolve to the same shared host: HubSpot's documented
 *  region-specific hosts (api-eu1.hsforms.com and so on) are for portals
 *  whose data residency requires them, and ap1 portals submit through this
 *  same host unless HubSpot support says otherwise for this specific
 *  portal. Kept as a map, not a literal, so that is a one-line change if it
 *  turns out not to be true here. */
const REGION_HOSTS: Record<typeof hubspot.region, string> = {
  na1: 'api.hsforms.com',
  ap1: 'api.hsforms.com',
};

/** True once both the portal id and the named form's GUID are known. While
 *  this is false, the form must still render; only the submit handler
 *  changes, showing the phone/email fallback instead of submitting. */
export function isHubspotConfigured(formKey: keyof typeof hubspot.forms): boolean {
  return hubspot.portalId !== null && hubspot.forms[formKey] !== null;
}

/** Build the submission URL for a configured form. Callers must check
 *  `isHubspotConfigured` first; this throws otherwise, so a missing GUID
 *  fails loudly during development rather than posting to a broken URL. */
export function submitUrl(formKey: keyof typeof hubspot.forms): string {
  const guid = hubspot.forms[formKey];
  if (hubspot.portalId === null || guid === null) {
    throw new Error(`HubSpot form "${formKey}" is not configured yet.`);
  }
  return `https://${REGION_HOSTS[hubspot.region]}/submissions/v3/integration/submit/${hubspot.portalId}/${guid}`;
}

/** Pull HubSpot's tracking cookie out of a document.cookie string, so a
 *  submission can be tied to the visitor's existing browsing history in the
 *  CRM. Split on the exact name to avoid matching a cookie that merely ends
 *  with it. */
export function readHubSpotCookie(cookieString: string): string | undefined {
  for (const part of cookieString.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'hubspotutk') {
      const value = rest.join('=');
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

/** A name has at least one letter and no digits. Deliberately permissive:
 *  apostrophes, hyphens and accents are all ordinary in real names. */
export function isValidName(value: string): boolean {
  return /\p{L}/u.test(value) && !/\d/.test(value);
}

/**
 * True when a value that was actually typed trims away to nothing, e.g.
 * "   ". A genuinely empty value ("") is not blank by this test: emptiness
 * is a required-field concern, handled separately by each field's own
 * `required` check. This only catches whitespace-only content, which would
 * otherwise reach HubSpot as an empty property after the payload builders
 * trim it. Applies to every text field, not just names.
 */
export function isBlankAfterTrim(value: string): boolean {
  return value !== '' && value.trim() === '';
}
