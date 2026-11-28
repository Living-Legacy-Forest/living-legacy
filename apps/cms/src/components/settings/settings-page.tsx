import {
  type DateFormat,
  type HomePage,
  type TimeFormat,
  SEO_DESCRIPTION_LIMIT,
  brandRulesProblem,
  contentTargetProblem,
  contentTargetsFrom,
  isEmailDomain,
  isValidAbn,
  isValidAcn,
  parseEmailDomains,
  sessionDayOptions,
  siteIconProblem,
  AI_DAILY_LIMIT_MAX,
  AI_INSTRUCTIONS_MAX,
} from '@ll/content';
import { CONSENT_MONTHS_OPTIONS } from '@ll/content/consent';
import { Link, getRouteApi, useBlocker, useNavigate, useRouter } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight, ChevronDownIcon, MoonIcon, SunIcon } from '@/components/icons';
import { type BrandName, BrandLogo } from '@/components/brand-logos';
import { InfoTip } from '@/components/info-tip';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPulse } from '@/components/system/status-pulse';
import { NumberField } from '@/components/ui/number-field';
import { BrandRulesEditor } from '@/components/settings/brand-rules-editor';
import {
  SettingsRow,
  SettingsSection,
  SettingsSectionFilter,
} from '@/components/settings/settings-section';
import { ThemeTiles } from '@/components/settings/theme-tiles';
import { MediaPicker, useMediaItem } from '@/components/media/image-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { reportInvalid } from '@/lib/form-validation';
import { formatDate, zoneOffset } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { setTheme, useThemeSync } from '@/lib/use-theme-sync';
import { cn } from '@/lib/utils';
import type { LegalPageSummary } from '@/server/legal-page-store';
import {
  type CmsColour,
  type CmsFont,
  type Locale,
  type SiteSettings,
  TITLE_TOKENS,
  type Theme,
  type TimeZone,
  cmsColours,
  cmsFonts,
  saveSiteSettings,
  timeZones,
} from '@/server/settings';
import { forgetCachedAiEnabled } from '@/lib/ai-status';
import { useRevealOnce } from '@/lib/use-reveal-once';
import type { SettingsSectionId } from '@/lib/settings-nav';

const rootRoute = getRouteApi('__root__');

const SITE_HOST = 'livinglegacy.com.au';

const weekStartItems = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
];

const dateFormatItems: { value: DateFormat; label: string }[] = [
  { value: 'short', label: '28 Nov 2026' },
  { value: 'numeric', label: '28/11/2026' },
  { value: 'iso', label: '2026-11-28' },
];

const flagItems: { value: 'flag' | 'ignore'; label: string }[] = [
  { value: 'flag', label: 'Flag' },
  { value: 'ignore', label: 'Ignore' },
];

const checkItems: { value: 'check' | 'skip'; label: string }[] = [
  { value: 'check', label: 'Check' },
  { value: 'skip', label: 'Skip' },
];

const timeFormatItems: { value: TimeFormat; label: string }[] = [
  { value: '12', label: '12-hour (1:05 pm)' },
  { value: '24', label: '24-hour (13:05)' },
];

const homePageItems: { value: HomePage; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'posts', label: 'Posts' },
  { value: 'calendar', label: 'Content calendar' },
  { value: 'events', label: 'Events' },
  { value: 'media', label: 'Media' },
  { value: 'analytics', label: 'Analytics' },
];

/** A dropdown for one of the settings that is a pick from a short list. */
function SettingsSelect<T extends string>({
  id,
  items,
  value,
  onChange,
}: {
  id: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next as T)}>
      <SelectTrigger id={id} className={fieldWidth}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const localeItems: { value: Locale; label: string }[] = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
];

const sessionItems = sessionDayOptions.map((days) => ({
  value: String(days),
  label: days === 1 ? 'After 1 day' : `After ${days} days`,
}));

const consentMonthItems = CONSENT_MONTHS_OPTIONS.map((months) => ({
  value: String(months),
  label: `${months} months`,
}));

const sidebarItems = [
  { value: '2', label: 'Two columns' },
  { value: '1', label: 'One column' },
];

const themeLabels: Record<Theme, string> = {
  system: 'System preference',
  light: 'Light',
  dark: 'Dark',
};

const fontLabels: Record<CmsFont, string> = {
  inter: 'Inter',
  geist: 'Geist',
  'ibm-plex-sans': 'IBM Plex Sans',
  atkinson: 'Atkinson Hyperlegible',
  montserrat: 'Montserrat',
  system: 'System font',
};

// Each option is shown in its own face (styles.css, [data-font]).
const fontItems: { value: CmsFont; label: ReactNode }[] = cmsFonts.map((value) => ({
  value,
  label: (
    <span data-font={value} className="font-sans">
      {fontLabels[value]}
    </span>
  ),
}));

const colourLabels: Record<CmsColour, string> = {
  neutral: 'Neutral',
  stone: 'Stone',
  forest: 'Forest',
  ocean: 'Ocean',
  clay: 'Clay',
};

// The swatch takes its colour from the palette's own values (styles.css, [data-colour]).
const colourItems: { value: CmsColour; label: ReactNode }[] = cmsColours.map((value) => ({
  value,
  label: (
    <span className="flex items-center gap-1.5">
      <span
        data-colour={value}
        aria-hidden
        className="size-3 shrink-0 rounded-full bg-[oklch(var(--tint-l)_var(--tint-c)_var(--tint-h))] ring-1 ring-black/10 dark:bg-[oklch(var(--tint-l-dark)_var(--tint-c)_var(--tint-h))] dark:ring-white/15"
      />
      {colourLabels[value]}
    </span>
  ),
}));

/**
 * Shows an unsaved choice app-wide as <html data-…> while it is picked, and
 * restores the saved one on leaving, so an unsaved preview never sticks.
 */
function usePreviewAttribute(name: 'font' | 'colour', value: string, persisted: string) {
  useEffect(() => {
    document.documentElement.dataset[name] = value;
  }, [name, value]);
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;
  useEffect(
    () => () => {
      document.documentElement.dataset[name] = persistedRef.current;
    },
    [name]
  );
}

const timeZoneLabels: Record<TimeZone, string> = {
  'Australia/Perth': 'Perth',
  'Australia/Darwin': 'Darwin',
  'Australia/Brisbane': 'Brisbane',
  'Australia/Adelaide': 'Adelaide',
  'Australia/Sydney': 'Sydney',
  'Australia/Melbourne': 'Melbourne',
  'Australia/Hobart': 'Hobart',
};

/** Offsets vary by zone and, for zones that observe it, by daylight saving. */
function timeZoneItems(): { value: TimeZone; label: string }[] {
  return timeZones.map((value) => ({
    value,
    label: `${timeZoneLabels[value]} (${zoneOffset(value)})`,
  }));
}

/** Which page of the form a field is on, so a problem found on another page can take you there. */
const FIELD_SECTIONS: [prefix: string, section: SettingsSectionId][] = [
  ['settings-abn', 'business'],
  ['settings-acn', 'business'],
  ['settings-domains', 'sign-in'],
  ['settings-title-pattern', 'search'],
  ['settings-target', 'content-targets'],
  ['brand-language', 'brand-language'],
  ['settings-cookie', 'cookies'],
  ['settings-ai', 'writing-assistant'],
];

/** Checks the browser cannot do with input types alone, mirrored on the server. */
function problem(v: SiteSettings): { field: string; message: string } | null {
  if (v.abn && !isValidAbn(v.abn)) {
    return { field: 'settings-abn', message: 'That ABN is not valid. Check the 11 digits.' };
  }
  if (v.acn && !isValidAcn(v.acn)) {
    return { field: 'settings-acn', message: 'That ACN is not valid. Check the 9 digits.' };
  }
  if (!parseEmailDomains(v.allowedEmailDomains).every(isEmailDomain)) {
    return {
      field: 'settings-domains',
      message: 'Enter domains such as example.com.au, separated by commas.',
    };
  }
  if (v.titlePattern && !v.titlePattern.includes(TITLE_TOKENS.page)) {
    return {
      field: 'settings-title-pattern',
      message: `The title pattern needs ${TITLE_TOKENS.page} where the page's own title goes.`,
    };
  }
  const targets = contentTargetProblem(contentTargetsFrom(v));
  if (targets) return { field: 'settings-target-words', message: targets };
  const brand = brandRulesProblem(v.brandRules);
  if (brand) return { field: 'brand-language', message: brand };
  const banner = (
    [
      ['settings-cookie-title', v.cookieTitle, 'The cookie banner needs a heading.'],
      ['settings-cookie-message', v.cookieMessage, 'The cookie banner needs a message.'],
      ['settings-cookie-analytics', v.cookieAnalyticsText, 'Describe the analytics cookies.'],
      ['settings-cookie-marketing', v.cookieMarketingText, 'Describe the marketing cookies.'],
    ] as const
  ).find(([, value]) => !value.trim());
  if (banner) return { field: banner[0], message: banner[2] };
  if (
    !Number.isInteger(v.aiDailyLimit) ||
    v.aiDailyLimit < 1 ||
    v.aiDailyLimit > AI_DAILY_LIMIT_MAX
  ) {
    return {
      field: 'settings-ai-limit',
      message: `Enter a whole number from 1 to ${AI_DAILY_LIMIT_MAX}.`,
    };
  }
  return null;
}

export function SettingsPage({
  data,
  seoOnly = false,
  assistantKeySet,
  legalPages,
  section,
}: {
  data: SiteSettings;
  /** The page of the settings form that is open; the rest of the form stays put behind it. */
  section: SettingsSectionId;
  /** For SEO people: only the Search & sharing section. */
  seoOnly?: boolean;
  /** Whether the writing assistant's key is set on the server, for admins; absent otherwise. */
  assistantKeySet?: boolean;
  /** The legal pages, for people who can edit them; absent for everyone else. */
  legalPages?: LegalPageSummary[];
}) {
  const [saved, setSaved] = useState(data);
  const [values, setValues] = useState(data);
  const { run, pending } = useAction();
  const router = useRouter();
  const navigate = useNavigate();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  // Preview the theme as soon as it's picked, not only once Save succeeds.
  // Preview the site theme as it is picked, unless this person has chosen their
  // own (Profile, Appearance): then the site's choice does not apply to them.
  const { personalTheme } = rootRoute.useLoaderData();
  useThemeSync(personalTheme ?? values.theme);

  // Leaving without saving must not leave an unsaved preview applied
  // app-wide, so restore whatever is actually persisted on unmount.
  const persistedTheme = rootRoute.useLoaderData().theme;
  const persistedThemeRef = useRef(persistedTheme);
  persistedThemeRef.current = persistedTheme;
  useEffect(() => () => setTheme(persistedThemeRef.current), []);

  // Font and colour preview the same way, and are put back the same way on leaving.
  const { cmsFont, cmsColour } = rootRoute.useLoaderData();
  usePreviewAttribute('font', values.cmsFont, cmsFont);
  usePreviewAttribute('colour', values.cmsColour, cmsColour);

  // Ask before leaving with unsaved changes, in the app and on tab close. Another page of the same
  // form is not leaving: the changes stay, and one Save covers every page.
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => dirty && !next.pathname.startsWith('/settings/'),
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  const patch = (next: Partial<SiteSettings>) => setValues((v) => ({ ...v, ...next }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const issue = problem(values);
    if (issue) {
      notify.error('Check the settings', issue.message);
      const there = FIELD_SECTIONS.find(([prefix]) => issue.field.startsWith(prefix))?.[1];
      if (there && there !== section) {
        // The field is on another page: open it, then focus the field once it is on screen.
        await navigate({ to: '/settings/$section', params: { section: there } });
        requestAnimationFrame(() => document.getElementById(issue.field)?.focus());
      } else {
        document.getElementById(issue.field)?.focus();
      }
      return;
    }
    const result = await run(() => saveSiteSettings({ data: values }), {
      success: { title: 'Settings saved', description: 'The website uses them from now on.' },
      error: 'Could not save the settings',
    });
    if (result) {
      setSaved(result);
      setValues(result);
      // The root loader caches the theme and time zone; pick up the new ones. The Suggest buttons
      // follow the switch, so they are asked about again too.
      forgetCachedAiEnabled();
      await router.invalidate();
    }
  }

  const exampleTitle = (values.titlePattern || TITLE_TOKENS.page)
    .replace(TITLE_TOKENS.page, 'Our story')
    .replace(TITLE_TOKENS.site, values.siteTitle);

  const revealing = useRevealOnce();

  return (
    <div data-slot="stack-page" data-revealing={revealing || undefined} className="w-full">
      <SettingsSectionFilter only={section}>
        <form noValidate onSubmit={submit} className="mx-auto max-w-3xl space-y-10">
          {!seoOnly && (
            <SettingsSection
              id="general"
              title="General"
              description="What the site is called and how people reach you. Changes reach the website within a minute."
              loose
            >
              <SettingsRow
                id="settings-site-title"
                title="Site title"
                description="Used in page titles, the footer and when pages are shared."
              >
                <Input
                  id="settings-site-title"
                  required
                  value={values.siteTitle}
                  onChange={(e) => patch({ siteTitle: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-tagline"
                title="Tagline"
                description="Shown under the logo in the website footer."
              >
                <Input
                  id="settings-tagline"
                  value={values.tagline}
                  placeholder="A short line that sums up the organisation"
                  onChange={(e) => patch({ tagline: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SiteIconRow
                mediaId={values.siteIconMediaId || null}
                siteTitle={values.siteTitle}
                onChange={(id) => patch({ siteIconMediaId: id ?? '' })}
                darkMediaId={values.siteIconDarkMediaId || null}
                onDarkChange={(id) => patch({ siteIconDarkMediaId: id ?? '' })}
              />
              <SettingsRow
                id="settings-email"
                title="Contact email"
                description="Offered when a website form cannot send."
              >
                <Input
                  id="settings-email"
                  type="email"
                  maxLength={120}
                  value={values.contactEmail}
                  placeholder="hello@example.com"
                  onChange={(e) => patch({ contactEmail: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-week-start"
                title="First day of the week"
                description="Where weeks begin in the CMS's calendars and date pickers."
              >
                <SettingsSelect
                  id="settings-week-start"
                  items={weekStartItems}
                  value={String(values.weekStartsOn)}
                  onChange={(value) => patch({ weekStartsOn: value === '0' ? 0 : 1 })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-date-format"
                title="Date format"
                description="How the CMS writes dates. The website keeps its own."
              >
                <SettingsSelect
                  id="settings-date-format"
                  items={dateFormatItems}
                  value={values.dateFormat}
                  onChange={(dateFormat) => patch({ dateFormat })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-time-format"
                title="Time format"
                description="How the CMS writes the time of day."
              >
                <SettingsSelect
                  id="settings-time-format"
                  items={timeFormatItems}
                  value={values.timeFormat}
                  onChange={(timeFormat) => patch({ timeFormat })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-home-page"
                title="Default home page"
                description="Where the CMS opens when someone signs in."
                info="The first time in a browser session. Anyone who can't open that page sees the dashboard."
              >
                <SettingsSelect
                  id="settings-home-page"
                  items={homePageItems}
                  value={values.homePage}
                  onChange={(homePage) => patch({ homePage })}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {!seoOnly && (
            <SettingsSection
              id="business"
              title="Contact & business"
              description="For the website footer, contact page and search results."
            >
              <SettingsRow
                id="settings-phone"
                title="Phone"
                description="Offered when a website form cannot send."
              >
                <Input
                  id="settings-phone"
                  type="tel"
                  maxLength={40}
                  value={values.phone}
                  placeholder="1300 000 000"
                  onChange={(e) => patch({ phone: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-after-hours-phone"
                title="After-hours phone"
                description="For out of hours. Shown on the contact page."
              >
                <Input
                  id="settings-after-hours-phone"
                  type="tel"
                  maxLength={40}
                  value={values.afterHoursPhone}
                  placeholder="0400 000 000"
                  onChange={(e) => patch({ afterHoursPhone: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-media-email"
                title="Media email"
                description="For journalists. Shown on the contact page."
              >
                <Input
                  id="settings-media-email"
                  type="email"
                  maxLength={120}
                  value={values.mediaEmail}
                  placeholder="media@example.com"
                  onChange={(e) => patch({ mediaEmail: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-bookings-email"
                title="Bookings email"
                description="Where replies to booking confirmations go."
              >
                <Input
                  id="settings-bookings-email"
                  type="email"
                  maxLength={120}
                  value={values.bookingsEmail}
                  placeholder="events@example.com"
                  onChange={(e) => patch({ bookingsEmail: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow id="settings-address" title="Address" stacked>
                <Textarea
                  id="settings-address"
                  rows={2}
                  value={values.address}
                  placeholder="Street, suburb, state and postcode"
                  onChange={(e) => patch({ address: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-postal-address"
                title="Postal address"
                description="Only if post goes somewhere other than the address above."
                stacked
              >
                <Textarea
                  id="settings-postal-address"
                  rows={2}
                  value={values.postalAddress}
                  placeholder="PO Box, suburb, state and postcode"
                  onChange={(e) => patch({ postalAddress: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-hours"
                title="Opening hours"
                description="Written as visitors should read it."
                stacked
              >
                <Textarea
                  id="settings-hours"
                  rows={2}
                  value={values.openingHours}
                  placeholder="Monday to Friday, 9am to 5pm"
                  onChange={(e) => patch({ openingHours: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow id="settings-legal-name" title="Legal name">
                <Input
                  id="settings-legal-name"
                  value={values.legalName}
                  placeholder="Company Pty Ltd"
                  onChange={(e) => patch({ legalName: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-trading-name"
                title="Trading name"
                description="Only if the business trades under a different name."
              >
                <Input
                  id="settings-trading-name"
                  value={values.tradingName}
                  placeholder="Living Legacy"
                  onChange={(e) => patch({ tradingName: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-abn"
                title="ABN"
                description="Checked and spaced for you when saved."
              >
                <Input
                  id="settings-abn"
                  inputMode="numeric"
                  value={values.abn}
                  placeholder="00 000 000 000"
                  onChange={(e) => patch({ abn: e.target.value })}
                  aria-invalid={values.abn !== '' && !isValidAbn(values.abn)}
                  className={cn(fieldWidth, 'tabular-nums')}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-acn"
                title="ACN"
                description="Checked and spaced for you when saved."
              >
                <Input
                  id="settings-acn"
                  inputMode="numeric"
                  value={values.acn}
                  placeholder="000 000 000"
                  onChange={(e) => patch({ acn: e.target.value })}
                  aria-invalid={values.acn !== '' && !isValidAcn(values.acn)}
                  className={cn(fieldWidth, 'tabular-nums')}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {!seoOnly && (
            <SettingsSection
              id="social"
              title="Social links"
              description="Shown in the website footer."
            >
              {(
                [
                  ['facebookUrl', 'Facebook', 'https://www.facebook.com/…', 'facebook'],
                  ['instagramUrl', 'Instagram', 'https://www.instagram.com/…', 'instagram'],
                  ['xUrl', 'X', 'https://x.com/…', 'x'],
                  ['youtubeUrl', 'YouTube', 'https://www.youtube.com/…', 'youtube'],
                  ['linkedinUrl', 'LinkedIn', 'https://www.linkedin.com/company/…', 'linkedin'],
                  ['tiktokUrl', 'TikTok', 'https://www.tiktok.com/@…', 'tiktok'],
                  ['googleBusinessUrl', 'Google reviews', 'https://g.page/…', 'google'],
                ] as const
              ).map(([key, title, placeholder, brand]) => (
                <SettingsRow
                  key={key}
                  id={`settings-${key}`}
                  title={title}
                  icon={<BrandLogo brand={brand satisfies BrandName} className="size-8" />}
                >
                  <Input
                    id={`settings-${key}`}
                    type="url"
                    maxLength={300}
                    value={values[key]}
                    placeholder={placeholder}
                    onChange={(e) => patch({ [key]: e.target.value })}
                    className={fieldWidth}
                  />
                </SettingsRow>
              ))}
            </SettingsSection>
          )}

          <SettingsSection
            id="search"
            title="Search & sharing"
            description="How pages appear in search results and when shared."
            loose
          >
            <SettingsRow
              id="settings-hide-search"
              title="Hide from search engines"
              description={
                values.hideFromSearch
                  ? 'On: search engines are asked to drop every page.'
                  : 'Asks search engines to leave every page out.'
              }
              info="Visitors can still open the site. Handy before a launch."
            >
              <Switch
                id="settings-hide-search"
                checked={values.hideFromSearch}
                onCheckedChange={(checked) => patch({ hideFromSearch: checked })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-title-pattern"
              title="Page title pattern"
              description={`${TITLE_TOKENS.page} is the page's title, ${TITLE_TOKENS.site} the site title.`}
            >
              <Input
                id="settings-title-pattern"
                value={values.titlePattern}
                placeholder={`${TITLE_TOKENS.page} | ${TITLE_TOKENS.site}`}
                onChange={(e) => patch({ titlePattern: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-description"
              title="Default description"
              suffix={<Counter value={values.seoDescription} limit={SEO_DESCRIPTION_LIMIT} />}
              stacked
            >
              <Textarea
                id="settings-description"
                value={values.seoDescription}
                placeholder="Summarise the site in a sentence or two."
                rows={2}
                onChange={(e) => patch({ seoDescription: e.target.value })}
                aria-invalid={values.seoDescription.length > SEO_DESCRIPTION_LIMIT}
              />
            </SettingsRow>
            <div className="space-y-1.5 max-md:px-4 max-md:py-3.5">
              <p className="text-muted-foreground text-xs">Search result preview</p>
              <SearchResultPreview
                title={exampleTitle}
                description={values.seoDescription}
                mediaId={values.seoImageMediaId}
                legacyUrl={values.seoImageUrl}
              />
            </div>
            <SettingsRow
              id="settings-share-image"
              title="Default share image"
              info="Used when a page has no image of its own."
              stacked
            >
              <ShareImageField
                title={exampleTitle}
                description={values.seoDescription}
                mediaId={values.seoImageMediaId}
                legacyUrl={values.seoImageUrl}
                onChange={(seoImageMediaId) => patch({ seoImageMediaId, seoImageUrl: '' })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-share-image-alt"
              title="Share image description"
              description="What the image shows, for people who can't see it."
            >
              <Input
                id="settings-share-image-alt"
                maxLength={200}
                value={values.seoImageAlt}
                onChange={(e) => patch({ seoImageAlt: e.target.value })}
                className={fieldWidth}
              />
            </SettingsRow>
            <h2 className="text-ui pt-2 font-medium max-md:px-4">Verification</h2>
            <SettingsRow
              id="settings-google"
              title="Google verification"
              description="From Search Console."
              info="Paste the code or the whole meta tag."
            >
              <Input
                id="settings-google"
                value={values.googleVerification}
                onChange={(e) => patch({ googleVerification: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-bing"
              title="Bing verification"
              description="From Bing Webmaster Tools."
              info="Paste the code or the whole meta tag."
            >
              <Input
                id="settings-bing"
                value={values.bingVerification}
                onChange={(e) => patch({ bingVerification: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-facebook-verification"
              title="Facebook verification"
              description="From Meta Business Suite."
              info="Paste the code or the whole meta tag."
            >
              <Input
                id="settings-facebook-verification"
                value={values.facebookVerification}
                onChange={(e) => patch({ facebookVerification: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-pinterest-verification"
              title="Pinterest verification"
              description="From your Pinterest settings."
              info="Paste the code or the whole meta tag."
            >
              <Input
                id="settings-pinterest-verification"
                value={values.pinterestVerification}
                onChange={(e) => patch({ pinterestVerification: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            id="content-targets"
            title="Content targets"
            description="What the content score measures blog posts against."
            loose
          >
            <h2 className="text-ui font-medium max-md:px-4">Structure</h2>
            <SettingsRow
              id="settings-target-words"
              title="Words"
              description="How long a post should be."
              below
            >
              <TargetRange
                id="settings-target-words"
                noun="words"
                min={values.targetWordsMin}
                max={values.targetWordsMax}
                onChange={(min, max) => patch({ targetWordsMin: min, targetWordsMax: max })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-headings"
              title="Headings"
              description="How many headings break up a post."
              below
            >
              <TargetRange
                id="settings-target-headings"
                noun="headings"
                min={values.targetHeadingsMin}
                max={values.targetHeadingsMax}
                onChange={(min, max) => patch({ targetHeadingsMin: min, targetHeadingsMax: max })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-paragraphs"
              title="Paragraphs"
              description="The fewest a post should have."
            >
              <TargetInput
                id="settings-target-paragraphs"
                label="Fewest paragraphs"
                value={values.targetParagraphsMin}
                onChange={(targetParagraphsMin) => patch({ targetParagraphsMin })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-images"
              title="Images"
              description="How many images a post should have."
              below
            >
              <TargetRange
                id="settings-target-images"
                noun="images"
                min={values.targetImagesMin}
                max={values.targetImagesMax}
                onChange={(min, max) => patch({ targetImagesMin: min, targetImagesMax: max })}
              />
            </SettingsRow>
            <h2 className="text-ui pt-2 font-medium max-md:px-4">Search listing</h2>
            <SettingsRow
              id="settings-target-title"
              title="Search title"
              description="Characters, so results don't cut it off."
              below
            >
              <TargetRange
                id="settings-target-title"
                noun="characters"
                min={values.targetTitleMin}
                max={values.targetTitleMax}
                onChange={(min, max) => patch({ targetTitleMin: min, targetTitleMax: max })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-description"
              title="Search description"
              description="Characters."
              below
            >
              <TargetRange
                id="settings-target-description"
                noun="characters"
                min={values.targetDescriptionMin}
                max={values.targetDescriptionMax}
                onChange={(min, max) =>
                  patch({ targetDescriptionMin: min, targetDescriptionMax: max })
                }
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-slug"
              title="Permalink"
              description="The most characters."
            >
              <TargetInput
                id="settings-target-slug"
                label="Most permalink characters"
                value={values.targetSlugMax}
                onChange={(targetSlugMax) => patch({ targetSlugMax })}
              />
            </SettingsRow>
            <h2 className="text-ui pt-2 font-medium max-md:px-4">Readability</h2>
            <SettingsRow
              id="settings-target-sentence"
              title="Sentence length"
              description="The most words a sentence averages."
            >
              <TargetInput
                id="settings-target-sentence"
                label="Most average sentence words"
                value={values.targetSentenceWords}
                onChange={(targetSentenceWords) => patch({ targetSentenceWords })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-long-paragraph"
              title="Longest paragraph"
              description="The most words one paragraph has."
            >
              <TargetInput
                id="settings-target-long-paragraph"
                label="Most paragraph words"
                value={values.targetParagraphWordsMax}
                onChange={(targetParagraphWordsMax) => patch({ targetParagraphWordsMax })}
              />
            </SettingsRow>
            <h2 className="text-ui pt-2 font-medium max-md:px-4">Keywords</h2>
            <SettingsRow
              id="settings-target-keyword"
              title="Focus keyword uses"
              description="The fewest times the focus keyword should appear in the body."
            >
              <TargetInput
                id="settings-target-keyword"
                label="Fewest focus keyword uses"
                value={values.targetFocusKeywordUses}
                onChange={(targetFocusKeywordUses) => patch({ targetFocusKeywordUses })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-target-terms"
              title="Related term uses"
              description="The fewest times each related term should appear."
            >
              <TargetInput
                id="settings-target-terms"
                label="Fewest related term uses"
                value={values.targetRelatedTermUses}
                onChange={(targetRelatedTermUses) => patch({ targetRelatedTermUses })}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            id="brand-language"
            title="Brand language"
            description="Words the content score flags, and what to write instead."
            loose
          >
            <h2 className="text-ui font-medium max-md:px-4">What to check</h2>
            <SettingsRow
              id="settings-brand-dashes"
              title="Dashes"
              description="Em and en dashes in a post."
            >
              <SettingsSelect
                id="settings-brand-dashes"
                items={flagItems}
                value={values.brandFlagDashes ? 'flag' : 'ignore'}
                onChange={(next) => patch({ brandFlagDashes: next === 'flag' })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-brand-exclamations"
              title="Exclamation marks"
              description="House style uses none in information copy."
            >
              <SettingsSelect
                id="settings-brand-exclamations"
                items={flagItems}
                value={values.brandFlagExclamations ? 'flag' : 'ignore'}
                onChange={(next) => patch({ brandFlagExclamations: next === 'flag' })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-brand-alts"
              title="Image descriptions"
              description="Look for the words below in alt text too."
            >
              <SettingsSelect
                id="settings-brand-alts"
                items={checkItems}
                value={values.brandCheckImageAlts ? 'check' : 'skip'}
                onChange={(next) => patch({ brandCheckImageAlts: next === 'check' })}
              />
            </SettingsRow>
            <SettingsRow
              id="settings-brand-listing"
              title="Search title and description"
              description="Look for the words below in them too."
            >
              <SettingsSelect
                id="settings-brand-listing"
                items={checkItems}
                value={values.brandCheckSearchListing ? 'check' : 'skip'}
                onChange={(next) => patch({ brandCheckSearchListing: next === 'check' })}
              />
            </SettingsRow>
            <div className="flex items-center gap-1.5 pt-2 max-md:px-4">
              <h2 className="text-ui font-medium">Words</h2>
              <InfoTip label="About the word list">
                <p>Never use counts as critical. Check is usually wrong but sometimes fine.</p>
                <p>The AI wording check uses this list too.</p>
              </InfoTip>
            </div>
            <div className="md:bg-muted/50 max-md:divide-y max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell) md:overflow-hidden md:rounded-lg">
              <BrandRulesEditor
                rules={values.brandRules}
                onChange={(brandRules) => patch({ brandRules })}
              />
            </div>
          </SettingsSection>

          {!seoOnly && (
            <SettingsSection
              id="writing-assistant"
              title="Writing assistant"
              description="Suggest buttons for search text, summaries, tags, alt text and brand fixes. They only suggest: nothing is saved until a person saves it."
              loose
            >
              <SettingsRow
                id="settings-ai-enabled"
                title="Suggest buttons"
                description="When off, the buttons are hidden for everyone."
                info="Nothing is sent to the AI while they are off."
              >
                <Switch
                  id="settings-ai-enabled"
                  checked={values.aiEnabled}
                  onCheckedChange={(checked) => patch({ aiEnabled: checked })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-ai-limit"
                title="Suggestions a day"
                description="Each person's limit. It starts again at midnight in the site's time zone."
                info="Counted each time a Suggest button is pressed. For a monthly cap on the whole bill, use the spend limit in the Anthropic Console."
              >
                <NumberField
                  id="settings-ai-limit"
                  min={1}
                  max={AI_DAILY_LIMIT_MAX}
                  value={values.aiDailyLimit}
                  aria-label="Suggestions each person can ask for a day"
                  onValueChange={(aiDailyLimit) => patch({ aiDailyLimit })}
                  className="w-32"
                />
              </SettingsRow>
              {assistantKeySet !== undefined && (
                <SettingsRow
                  id="settings-ai-key"
                  title="Connection"
                  description={
                    assistantKeySet
                      ? 'Use and cost are on the System page.'
                      : 'No key is set, so the buttons are hidden.'
                  }
                  info={
                    assistantKeySet
                      ? 'The key is set on the server.'
                      : 'An admin adds it as the ANTHROPIC_API_KEY secret on the CMS Worker.'
                  }
                >
                  <StatusPulse
                    tone={assistantKeySet ? 'green' : 'yellow'}
                    label={assistantKeySet ? 'Connected' : 'Not set up'}
                  />
                </SettingsRow>
              )}
              <h2 className="text-ui pt-2 font-medium max-md:px-4">What it can suggest</h2>
              {(
                [
                  ['aiSearchText', 'Search text', 'Search title, description and focus keyword.'],
                  ['aiSummaries', 'Summaries', 'The summary shown on blog cards.'],
                  ['aiTags', 'Tags', 'Post tags and image tags.'],
                  ['aiImageText', 'Image text', 'Alt text and captions.'],
                  ['aiBrandFixes', 'Brand fixes', 'Rewrites for flagged words.'],
                ] as const
              ).map(([key, title, description]) => (
                <SettingsRow
                  key={key}
                  id={`settings-${key}`}
                  title={title}
                  description={description}
                >
                  <Switch
                    id={`settings-${key}`}
                    checked={values[key]}
                    onCheckedChange={(checked) => patch({ [key]: checked })}
                  />
                </SettingsRow>
              ))}
              <SettingsRow
                id="settings-ai-instructions"
                title="Extra instructions"
                description="Added to every suggestion. The brand guide still wins."
                suffix={<Counter value={values.aiInstructions} limit={AI_INSTRUCTIONS_MAX} />}
                stacked
              >
                <Textarea
                  id="settings-ai-instructions"
                  rows={3}
                  maxLength={AI_INSTRUCTIONS_MAX}
                  value={values.aiInstructions}
                  placeholder="For example: keep it warm and gentle, and write for families."
                  onChange={(e) => patch({ aiInstructions: e.target.value })}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {/* Only while Legal is the open page: its redirect must not fire from the others. */}
          {legalPages && section === 'legal' && <LegalPagesSection pages={legalPages} />}

          {!seoOnly && (
            <SettingsSection
              id="cookies"
              title="Cookies & privacy"
              description="The website asks visitors before it loads analytics or marketing tags. These words and this lifetime reach the website within a minute or two. The tags themselves are connected on the Integrations page."
            >
              <SettingsRow id="settings-cookie-title" title="Banner heading">
                <Input
                  id="settings-cookie-title"
                  maxLength={80}
                  value={values.cookieTitle}
                  onChange={(e) => patch({ cookieTitle: e.target.value })}
                  className={fieldWidth}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-cookie-message"
                title="Banner message"
                description="A link to the privacy policy follows it."
                suffix={<Counter value={values.cookieMessage} limit={600} />}
                stacked
              >
                <Textarea
                  id="settings-cookie-message"
                  rows={3}
                  value={values.cookieMessage}
                  onChange={(e) => patch({ cookieMessage: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-cookie-analytics"
                title="Analytics cookies"
                description="What visitors read beside the Analytics choice. Name the tools that use them."
                suffix={<Counter value={values.cookieAnalyticsText} limit={300} />}
                stacked
              >
                <Textarea
                  id="settings-cookie-analytics"
                  rows={2}
                  value={values.cookieAnalyticsText}
                  onChange={(e) => patch({ cookieAnalyticsText: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-cookie-marketing"
                title="Marketing cookies"
                description="What visitors read beside the Marketing choice. Name the tools that use them."
                suffix={<Counter value={values.cookieMarketingText} limit={300} />}
                stacked
              >
                <Textarea
                  id="settings-cookie-marketing"
                  rows={2}
                  value={values.cookieMarketingText}
                  onChange={(e) => patch({ cookieMarketingText: e.target.value })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-consent-months"
                title="Ask again after"
                description="How long a visitor's choice is kept before the banner returns. Changing it applies to choices made from now on."
              >
                <Select
                  items={consentMonthItems}
                  value={String(values.consentMonths)}
                  onValueChange={(value) => value && patch({ consentMonths: Number(value) })}
                >
                  <SelectTrigger id="settings-consent-months" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {consentMonthItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          )}

          {!seoOnly && (
            <SettingsSection
              id="sign-in"
              title="Sign-in & security"
              description="Who can be invited to the CMS and how people sign in."
            >
              <SettingsRow
                id="settings-domains"
                title="Allowed email domains"
                description="Invites only go to these, separated by commas. Leave empty to allow any. People already here keep access."
                stacked
              >
                <Input
                  id="settings-domains"
                  value={values.allowedEmailDomains}
                  placeholder="livinglegacy.com.au, sistercreatives.co"
                  onChange={(e) => patch({ allowedEmailDomains: e.target.value })}
                  className="font-mono"
                />
              </SettingsRow>
              <SettingsRow
                id="settings-google-sign-in"
                title="Sign in with Google"
                description="When off, everyone signs in with an email link."
              >
                <Switch
                  id="settings-google-sign-in"
                  checked={values.googleSignIn}
                  onCheckedChange={(checked) => patch({ googleSignIn: checked })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-session"
                title="Sign out when idle"
                description="How long someone can be away from the CMS before signing in again."
              >
                <Select
                  items={sessionItems}
                  value={String(values.sessionDays)}
                  onValueChange={(value) => value && patch({ sessionDays: Number(value) })}
                >
                  <SelectTrigger id="settings-session" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          )}

          {!seoOnly && (
            <SettingsSection
              id="appearance"
              title="Language & appearance"
              description="The site's language, time zone, and the CMS theme, sidebar, colour and font."
            >
              <SettingsRow id="settings-locale" title="Language">
                <Select
                  items={localeItems}
                  value={values.locale}
                  onValueChange={(value) => value && patch({ locale: value as Locale })}
                >
                  <SelectTrigger id="settings-locale" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow
                id="settings-time-zone"
                title="Time zone"
                description="Used to interpret opening hours and to schedule posts and announcements."
              >
                <Select
                  items={timeZoneItems()}
                  value={values.timeZone}
                  onValueChange={(value) => value && patch({ timeZone: value as TimeZone })}
                >
                  <SelectTrigger id="settings-time-zone" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeZoneItems().map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow
                id="settings-theme"
                title="Theme"
                stacked
                description={
                  // Their own choice wins over this one, so without this the
                  // setting would seem to do nothing for them.
                  personalTheme ? (
                    <>
                      You use your own theme ({themeLabels[personalTheme].toLowerCase()}), so this
                      changes the CMS for everyone else. To follow it yourself, choose Site setting
                      in{' '}
                      <Link
                        to="/profile"
                        hash="appearance"
                        className="underline underline-offset-2"
                      >
                        your profile
                      </Link>
                      .
                    </>
                  ) : undefined
                }
              >
                <ThemeTiles
                  id="settings-theme"
                  value={values.theme}
                  labels={{ light: 'Light', dark: 'Dark', system: 'System' }}
                  onChange={(theme) => patch({ theme })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-sidebar"
                title="Sidebar"
                description="The default for everyone. People can choose their own."
                info={
                  <>
                    <p>Two columns: sections down the left and their pages beside them.</p>
                    <p>
                      One column: every section under its own heading, with the tools in a menu at
                      the bottom.
                    </p>
                    <p>Anyone can pick their own on their profile, which then wins over this.</p>
                  </>
                }
              >
                <Select
                  items={sidebarItems}
                  value={String(values.sidebarColumns)}
                  onValueChange={(value) =>
                    value && patch({ sidebarColumns: value === '1' ? 1 : 2 })
                  }
                >
                  <SelectTrigger id="settings-sidebar" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sidebarItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow
                id="settings-colour"
                title="Colour"
                description="Tints buttons, highlights and the sidebar, in light and dark."
              >
                <Select
                  items={colourItems}
                  value={values.cmsColour}
                  onValueChange={(value) => value && patch({ cmsColour: value as CmsColour })}
                >
                  <SelectTrigger id="settings-colour" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colourItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow
                id="settings-font"
                title="Font"
                description="The typeface the CMS uses, for everyone. The website keeps its own."
              >
                <Select
                  items={fontItems}
                  value={values.cmsFont}
                  onValueChange={(value) => value && patch({ cmsFont: value as CmsFont })}
                >
                  <SelectTrigger id="settings-font" className={fieldWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          )}

          {/* Only there while something is unsaved, so it never nags. */}
          <div
            className={cn(
              'bg-background/95 sticky bottom-[calc(var(--tab-bar-height)+1rem)] z-10 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg backdrop-blur transition-all',
              dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
            )}
            aria-hidden={!dirty}
          >
            {/* Phones: the short form, so the message and both buttons fit on one line. */}
            <span className="mr-auto min-w-0 truncate text-sm">
              <span className="md:hidden">Unsaved changes</span>
              <span className="max-md:hidden">You have unsaved changes.</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setValues(saved)}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                <>
                  Save<span className="max-md:hidden"> changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </SettingsSectionFilter>

      <AlertDialog open={blocker.status === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to the settings will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const fieldWidth = 'w-full sm:w-72';

function TargetInput({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <NumberField
      id={id}
      min={0}
      value={value}
      aria-label={label}
      onValueChange={onChange}
      className={cn('w-32', className)}
    />
  );
}

/** Two numbers, fewest and most, for one target. */
function TargetRange({
  id,
  noun,
  min,
  max,
  onChange,
}: {
  id: string;
  noun: string;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    // Phones: the two fields share the row's full width, under the title.
    <div className="flex items-center gap-2 max-md:w-full">
      <TargetInput
        id={id}
        label={`Fewest ${noun}`}
        value={min}
        onChange={(n) => onChange(n, max)}
        className="max-md:w-auto max-md:flex-1"
      />
      <span className="text-muted-foreground text-xs">to</span>
      <TargetInput
        label={`Most ${noun}`}
        value={max}
        onChange={(n) => onChange(min, n)}
        className="max-md:w-auto max-md:flex-1"
      />
    </div>
  );
}

function Counter({ value, limit }: { value: string; limit: number }) {
  return (
    <span
      className={cn(
        'text-muted-foreground text-xs tabular-nums',
        value.length > limit && 'text-destructive'
      )}
    >
      {value.length}/{limit}
    </span>
  );
}

/** A small preview of the share image, at the 1.91:1 shape link previews use. */
/**
 * The icon for browser tabs and home screens, one upload for light mode and one for dark mode,
 * each shown on a tab in its own colours, at the size people actually see it. Dark is optional:
 * without it the light icon is used in both. Until a light icon is chosen the built-in one shows.
 */
function SiteIconRow({
  mediaId,
  siteTitle,
  onChange,
  darkMediaId,
  onDarkChange,
}: {
  mediaId: string | null;
  siteTitle: string;
  onChange: (mediaId: string | null) => void;
  darkMediaId: string | null;
  onDarkChange: (mediaId: string | null) => void;
}) {
  const light = useMediaItem(mediaId);
  const lightSrc = light.item ? `${light.item.url}?w=640` : '/icon-192.png';

  return (
    <SettingsRow
      id="settings-site-icon"
      title="Site icon"
      description="Shown in browser tabs, bookmarks and on phone home screens."
      info={
        <>
          <p>
            For the website and the CMS. Add one for light mode and, if you like, a different one
            for dark mode.
          </p>
          <p>Each should be a square image at least 512 by 512 pixels; PNG works best.</p>
          <p>
            Phone home screens always use the light mode icon, and so does a browser with scripts
            turned off.
          </p>
        </>
      }
      stacked
    >
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <SiteIconPanel
          mode="light"
          mediaId={mediaId}
          item={light.item}
          update={light.update}
          fallbackSrc="/icon-192.png"
          emptyNote="Using the built-in icon."
          siteTitle={siteTitle}
          onChange={onChange}
          pickerId="settings-site-icon"
        />
        <SiteIconPanel
          mode="dark"
          mediaId={darkMediaId}
          fallbackSrc={lightSrc}
          emptyNote="Using the light mode icon."
          siteTitle={siteTitle}
          onChange={onDarkChange}
        />
      </div>
    </SettingsRow>
  );
}

const TAB_PREVIEW = {
  light: {
    window: 'bg-[#e4e4e8] ring-black/10',
    chrome: 'bg-black/[0.07] text-neutral-600',
    tab: 'bg-white text-neutral-900 shadow-xs',
    close: 'text-neutral-400',
  },
  dark: {
    window: 'bg-[#1f1f22] ring-black/20',
    chrome: 'bg-white/10 text-neutral-300',
    tab: 'bg-white/[0.09] text-neutral-100',
    close: 'text-neutral-400',
  },
} as const;

/** The icon in a browser tab, drawn in light or dark whatever the CMS's own theme is. */
function TabPreview({
  mode,
  src,
  siteTitle,
}: {
  mode: 'light' | 'dark';
  src: string;
  siteTitle: string;
}) {
  const look = TAB_PREVIEW[mode];
  return (
    <div aria-hidden className={cn('overflow-hidden rounded-xl shadow-md ring-1', look.window)}>
      <div className="flex h-10 items-center gap-2 px-2.5">
        <span className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span
          className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', look.chrome)}
        >
          <ChevronDownIcon className="size-3" />
        </span>
        <span
          className={cn(
            'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-xs',
            look.tab
          )}
        >
          <img src={src} alt="" className="size-4 shrink-0 rounded-[3px] object-cover" />
          <span className="truncate">{siteTitle || 'Site title'}</span>
          <span className={cn('ml-auto pl-1 text-sm leading-none', look.close)}>×</span>
        </span>
      </div>
    </div>
  );
}

/** One mode's icon: its tab preview, then Choose, Change and Remove. */
function SiteIconPanel({
  mode,
  mediaId,
  item: givenItem,
  update: givenUpdate,
  fallbackSrc,
  emptyNote,
  siteTitle,
  onChange,
  pickerId,
}: {
  mode: 'light' | 'dark';
  mediaId: string | null;
  /** The light panel's media item, which the row already loads to preview the dark one. */
  item?: ReturnType<typeof useMediaItem>['item'];
  update?: ReturnType<typeof useMediaItem>['update'];
  /** What the tab shows while nothing is chosen. */
  fallbackSrc: string;
  emptyNote: string;
  siteTitle: string;
  onChange: (mediaId: string | null) => void;
  /** The id on the Choose button, so an error toast can name the field. */
  pickerId?: string;
}) {
  const own = useMediaItem(givenItem === undefined ? mediaId : null);
  const item = givenItem === undefined ? own.item : givenItem;
  const update = givenUpdate ?? own.update;
  const [picking, setPicking] = useState(false);
  const Icon = mode === 'light' ? SunIcon : MoonIcon;
  const label = mode === 'light' ? 'light mode icon' : 'dark mode icon';
  const src = item ? `${item.url}?w=640` : fallbackSrc;
  // Saving checks this too; saying so on picking saves a round trip.
  const problem = item ? siteIconProblem(item, label) : null;

  return (
    <div className="bg-muted/50 space-y-3 rounded-lg p-3">
      <p className="text-ui flex items-center gap-1.5 font-medium">
        <Icon aria-hidden className="text-muted-foreground size-4" />
        {mode === 'light' ? 'Light mode' : 'Dark mode'}
      </p>
      <TabPreview mode={mode} src={src} siteTitle={siteTitle} />
      {problem && <p className="text-destructive text-xs">{problem}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          id={pickerId}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicking(true)}
        >
          {mediaId ? 'Change icon' : 'Choose icon'}
        </Button>
        {mediaId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">{emptyNote}</span>
        )}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={mediaId}
        aspect={1}
        onSelect={(picked) => {
          update(picked);
          onChange(picked.id);
          setPicking(false);
        }}
      />
    </div>
  );
}

/** The share image's address for a preview: the library image, else a link typed in earlier. */
function useShareImage(mediaId: string, legacyUrl: string) {
  const { item, update } = useMediaItem(mediaId || null);
  const src = mediaId
    ? item
      ? `${item.url}?w=640`
      : null
    : /^https?:\/\/\S+$/.test(legacyUrl)
      ? legacyUrl
      : null;
  return { src, update };
}

/** How a page looks in a search result, with the share image beside it as the results show it. */
function SearchResultPreview({
  title,
  description,
  mediaId,
  legacyUrl,
}: {
  title: string;
  description: string;
  mediaId: string;
  legacyUrl: string;
}) {
  const { src } = useShareImage(mediaId, legacyUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div className="bg-muted/50 flex items-start gap-4 rounded-lg px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-xs">{SITE_HOST} › our-story</p>
        <p className="truncate text-base text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {description || 'Your default description shows here.'}
        </p>
      </div>
      {src && !broken && (
        <img
          src={src}
          alt=""
          className="bg-muted aspect-[1.91/1] w-28 shrink-0 rounded-md object-cover max-sm:hidden"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/** The card a link makes when pasted into Facebook, X, WhatsApp or LinkedIn: the image on top. */
function ShareCardPreview({
  title,
  description,
  mediaId,
  legacyUrl,
}: {
  title: string;
  description: string;
  mediaId: string;
  legacyUrl: string;
}) {
  const { src } = useShareImage(mediaId, legacyUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div className="bg-muted/50 overflow-hidden rounded-lg border">
      <div className="bg-muted aspect-[1.91/1] w-full">
        {src && !broken ? (
          <img
            src={src}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <p className="text-muted-foreground flex h-full items-center justify-center p-3 text-center text-xs">
            {broken ? 'Image not found' : 'No image chosen'}
          </p>
        )}
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        <p className="text-muted-foreground truncate text-xs uppercase">{SITE_HOST}</p>
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {description || 'Your default description shows here.'}
        </p>
      </div>
    </div>
  );
}

/**
 * The default share image, chosen from the media library. A link typed in before that was
 * possible still shows, until the image is changed or removed.
 */
function ShareImageField({
  title,
  description,
  mediaId,
  legacyUrl,
  onChange,
}: {
  title: string;
  description: string;
  mediaId: string;
  legacyUrl: string;
  onChange: (mediaId: string) => void;
}) {
  const { update } = useShareImage(mediaId, legacyUrl);
  const [picking, setPicking] = useState(false);
  const chosen = Boolean(mediaId || legacyUrl);

  return (
    <div className="max-w-sm space-y-3">
      {/* The image is shown as a pasted link's card shows it, so what is chosen reads as it will. */}
      <ShareCardPreview
        title={title}
        description={description}
        mediaId={mediaId}
        legacyUrl={legacyUrl}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          {chosen ? 'Change image' : 'Choose image'}
        </Button>
        {chosen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange('')}
          >
            Remove
          </Button>
        )}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={mediaId || null}
        aspect={1.91}
        onSelect={(picked) => {
          update(picked);
          onChange(picked.id);
          setPicking(false);
        }}
      />
    </div>
  );
}

/**
 * The privacy and terms pages, each opening its editor. From md the sidebar lists them under
 * Legal, so this opens the first straight away; phones have no sidebar, so this is their list.
 */
function LegalPagesSection({ pages }: { pages: LegalPageSummary[] }) {
  const timeZone = useTimeZone();
  const navigate = useNavigate();
  const first = pages[0]?.slug;
  useEffect(() => {
    if (!first || !window.matchMedia('(min-width: 48rem)').matches) return;
    void navigate({ to: '/legal/$slug', params: { slug: first }, replace: true });
  }, [first, navigate]);
  return (
    <SettingsSection
      id="legal"
      title="Legal"
      framed
      divided={false}
      description="Changes go live when an admin publishes them. Every published version is kept."
    >
      {pages.map((page) => (
        <Link
          key={page.slug}
          to="/legal/$slug"
          params={{ slug: page.slug }}
          className="hover:bg-muted/50 touch:min-h-11 flex items-center gap-3 px-4 py-3"
        >
          <span className="min-w-0 flex-1">
            <span className="text-ui block font-medium">{page.title}</span>
            <span className="text-muted-foreground block text-xs">
              {page.lastPublishedAt
                ? `Last updated ${formatDate(page.lastPublishedAt, timeZone)}`
                : 'Not published'}
            </span>
          </span>
          <StatusBadge
            kind={
              page.reviewRequestedAt
                ? 'review'
                : page.hasDraft
                  ? 'changes'
                  : page.lastPublishedAt
                    ? 'published'
                    : 'draft'
            }
          />
          <ArrowRight aria-hidden className="text-muted-foreground size-4" />
        </Link>
      ))}
    </SettingsSection>
  );
}
