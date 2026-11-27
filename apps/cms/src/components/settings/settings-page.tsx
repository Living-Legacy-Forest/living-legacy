import {
  SEO_DESCRIPTION_LIMIT,
  brandRulesProblem,
  contentTargetProblem,
  contentTargetsFrom,
  isEmailDomain,
  isValidAbn,
  parseEmailDomains,
  sessionDayOptions,
  siteIconProblem,
  AI_DAILY_LIMIT_MAX,
} from '@ll/content';
import { CONSENT_MONTHS_OPTIONS } from '@ll/content/consent';
import { Link, getRouteApi, useBlocker, useRouter } from '@tanstack/react-router';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPulse } from '@/components/system/status-pulse';
import { NumberField } from '@/components/ui/number-field';
import { BrandRulesEditor } from '@/components/settings/brand-rules-editor';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
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
import { RevealWords } from '@/components/dashboard/reveal-words';

const rootRoute = getRouteApi('__root__');

const SITE_HOST = 'livinglegacy.com.au';

const sections = [
  { id: 'general', title: 'General' },
  { id: 'business', title: 'Contact & business' },
  { id: 'social', title: 'Social links' },
  { id: 'search', title: 'Search & sharing' },
  { id: 'content-targets', title: 'Content targets' },
  { id: 'brand-language', title: 'Brand language' },
  { id: 'writing-assistant', title: 'Writing assistant' },
  { id: 'legal', title: 'Legal' },
  { id: 'cookies', title: 'Cookies & privacy' },
  { id: 'sign-in', title: 'Sign-in & security' },
  { id: 'appearance', title: 'Language & appearance' },
] as const;

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

/** Checks the browser cannot do with input types alone, mirrored on the server. */
function problem(v: SiteSettings): { field: string; message: string } | null {
  if (v.abn && !isValidAbn(v.abn)) {
    return { field: 'settings-abn', message: 'That ABN is not valid. Check the 11 digits.' };
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
}: {
  data: SiteSettings;
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

  // Ask before leaving with unsaved changes, in the app and on tab close.
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
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
      document.getElementById(issue.field)?.focus();
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
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-5xl"
    >
      <div className="mb-8 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Settings" />
        </h1>
        <p className="text-muted-foreground text-sm">
          Site-wide details used across the CMS and, once connected, the public website.
        </p>
      </div>

      <div>
        <SectionNav
          ids={sections
            .map((x) => x.id)
            .filter((id) =>
              id === 'legal'
                ? legalPages !== undefined
                : !seoOnly || id === 'search' || id === 'content-targets' || id === 'brand-language'
            )}
        />

        <form noValidate onSubmit={submit} className="space-y-10">
          {!seoOnly && (
            <SettingsSection
              id="general"
              title="General"
              description="What the site is called and how people reach you. Changes reach the website within a minute."
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
                  ['facebookUrl', 'Facebook', 'https://www.facebook.com/…'],
                  ['instagramUrl', 'Instagram', 'https://www.instagram.com/…'],
                  ['youtubeUrl', 'YouTube', 'https://www.youtube.com/…'],
                  ['linkedinUrl', 'LinkedIn', 'https://www.linkedin.com/company/…'],
                  ['tiktokUrl', 'TikTok', 'https://www.tiktok.com/@…'],
                  ['googleBusinessUrl', 'Google reviews', 'https://g.page/…'],
                ] as const
              ).map(([key, title, placeholder]) => (
                <SettingsRow key={key} id={`settings-${key}`} title={title}>
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
            description="How pages appear in search results and when shared, unless a page sets its own."
          >
            <SettingsRow
              id="settings-hide-search"
              title="Hide from search engines"
              description={
                values.hideFromSearch
                  ? 'On: search engines are asked to drop every page. Visitors can still open the site.'
                  : 'Asks search engines to leave every page out of their results, such as before a launch.'
              }
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
              <div className="bg-muted/50 rounded-md px-4 py-3">
                <p className="text-muted-foreground truncate text-xs">{SITE_HOST} › our-story</p>
                <p className="truncate text-base text-[#1a0dab] dark:text-[#8ab4f8]">
                  {exampleTitle}
                </p>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {values.seoDescription || 'Your default description shows here.'}
                </p>
              </div>
            </div>
            <SettingsRow id="settings-share-image" title="Default share image" stacked>
              <div className="flex items-start gap-3">
                <Input
                  id="settings-share-image"
                  type="url"
                  maxLength={300}
                  value={values.seoImageUrl}
                  placeholder="https://…/share-image.jpg"
                  onChange={(e) => patch({ seoImageUrl: e.target.value })}
                />
                <SharePreview url={values.seoImageUrl} />
              </div>
            </SettingsRow>
            <SettingsRow
              id="settings-google"
              title="Google verification"
              description="From Search Console. Paste the code or the whole meta tag."
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
              description="From Bing Webmaster Tools. Code or meta tag."
            >
              <Input
                id="settings-bing"
                value={values.bingVerification}
                onChange={(e) => patch({ bingVerification: e.target.value })}
                className={cn(fieldWidth, 'font-mono')}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            id="content-targets"
            title="Content targets"
            description="What the content score measures blog posts against."
          >
            <SettingsRow id="settings-target-words" title="Words" below>
              <TargetRange
                id="settings-target-words"
                noun="words"
                min={values.targetWordsMin}
                max={values.targetWordsMax}
                onChange={(min, max) => patch({ targetWordsMin: min, targetWordsMax: max })}
              />
            </SettingsRow>
            <SettingsRow id="settings-target-headings" title="Headings" below>
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
            <SettingsRow id="settings-target-images" title="Images" below>
              <TargetRange
                id="settings-target-images"
                noun="images"
                min={values.targetImagesMin}
                max={values.targetImagesMax}
                onChange={(min, max) => patch({ targetImagesMin: min, targetImagesMax: max })}
              />
            </SettingsRow>
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
            framed
            description="Words the content score flags in posts, and what to write instead. Never use counts as critical; Check is usually wrong but sometimes fine. The AI wording check uses this list too."
          >
            <BrandRulesEditor
              rules={values.brandRules}
              onChange={(brandRules) => patch({ brandRules })}
            />
          </SettingsSection>

          {!seoOnly && (
            <SettingsSection
              id="writing-assistant"
              title="Writing assistant"
              description="The Suggest buttons that write search text, summaries, tags, alt text, captions and brand fixes. They only suggest: nothing is saved until a person saves it."
            >
              <SettingsRow
                id="settings-ai-enabled"
                title="Suggest buttons"
                description="When off, the buttons are hidden for everyone and nothing is sent to the AI."
              >
                <Switch
                  id="settings-ai-enabled"
                  checked={values.aiEnabled}
                  onCheckedChange={(checked) => patch({ aiEnabled: checked })}
                />
              </SettingsRow>
              <SettingsRow
                id="settings-ai-limit"
                title="Suggestions each person can ask for a day"
                description="Counted each time a Suggest button is pressed, and starting again at midnight in the site's time zone. For a monthly cap on the whole bill, use the spend limit in the Anthropic Console."
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
                      ? 'The key is set on the server. Use and cost are on the System page.'
                      : 'No key is set on the server, so the buttons are hidden. An admin adds it as the ANTHROPIC_API_KEY secret on the CMS Worker.'
                  }
                >
                  <StatusPulse
                    tone={assistantKeySet ? 'green' : 'yellow'}
                    label={assistantKeySet ? 'Connected' : 'Not set up'}
                  />
                </SettingsRow>
              )}
            </SettingsSection>
          )}

          {legalPages && <LegalPagesSection pages={legalPages} />}

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
      </div>

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

/**
 * Glides to a section. Done per click rather than with a global smooth scroll,
 * so page changes and scroll restoration stay instant. Respects reduced motion.
 *
 * The hash is written once the glide ends: TanStack Router wraps
 * history.replaceState and jumps straight to a #hash target, which would cut
 * the glide short. `scrollend` is missing in older Safari, hence the timer.
 */
function scrollToSection(id: string, onDone: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener('scrollend', finish);
    history.replaceState(history.state, '', `#${id}`);
    onDone();
  };
  window.addEventListener('scrollend', finish, { once: true });
  window.setTimeout(finish, reduce ? 0 : 1000);
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}

/** Jump links to each section; the one in view is highlighted. Desktop only. */
function SectionNav({ ids }: { ids: string[] }) {
  const shown = sections.filter((section) => ids.includes(section.id));
  const [active, setActive] = useState<string>(shown[0]?.id ?? '');
  // While a clicked link's glide runs, the sections it passes must not take
  // the highlight from the one that was clicked.
  const gliding = useRef(false);

  useEffect(() => {
    // Current is the last section whose top has passed just under the header,
    // or the last one at the bottom of the page, since the final sections are
    // short and never reach the top.
    let frame = 0;
    const update = () => {
      frame = 0;
      if (gliding.current) return;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = shown.filter(
        ({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 140
      );
      const current = atBottom ? shown[shown.length - 1] : (passed.at(-1) ?? shown[0]);
      if (current) setActive(current.id);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Keeps the current tab in view when the row is wider than the page.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = list.current;
    const link = ul?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!ul || !link) return;
    const left = link.offsetLeft - ul.offsetLeft;
    if (left < ul.scrollLeft || left + link.offsetWidth > ul.scrollLeft + ul.clientWidth) {
      ul.scrollTo({ left: left - 16, behavior: 'smooth' });
    }
  }, [active]);

  return (
    // A row of tabs under the header, as on a settings screen; it stays one page and one Save,
    // so the tabs jump to sections and follow the one in view. From md; phones scroll.
    <nav
      aria-label="Settings sections"
      className="bg-background sticky top-16 z-20 mb-8 hidden py-1.5 md:block"
    >
      <ul ref={list} className="no-scrollbar flex gap-1 overflow-x-auto">
        {shown.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                gliding.current = true;
                setActive(section.id);
                scrollToSection(section.id, () => {
                  gliding.current = false;
                });
              }}
              className={cn(
                'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] text-ui block rounded-md px-2.5 py-1 whitespace-nowrap transition-colors',
                active === section.id && 'bg-foreground/10 text-foreground font-medium'
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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
      description="Shown in browser tabs, bookmarks and on phone home screens, for the website and the CMS. Add one for light mode and, if you like, a different one for dark mode. Each should be a square image at least 512 by 512 pixels; PNG works best."
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
      <p className="text-muted-foreground max-w-2xl text-xs">
        Phone home screens always use the light mode icon, and a browser with scripts turned off
        shows it too.
      </p>
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
    <div className="bg-muted/50 space-y-3 rounded-xl p-3">
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

function SharePreview({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (!/^https?:\/\/\S+$/.test(url)) return null;

  return (
    <div className="bg-muted aspect-[1.91/1] w-28 shrink-0 overflow-hidden rounded-md border">
      {broken ? (
        <p className="text-muted-foreground flex h-full items-center justify-center p-1 text-center text-[11px]">
          Image not found
        </p>
      ) : (
        <img src={url} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      )}
    </div>
  );
}

/** The privacy and terms pages, each opening its editor. */
function LegalPagesSection({ pages }: { pages: LegalPageSummary[] }) {
  const timeZone = useTimeZone();
  return (
    <SettingsSection
      id="legal"
      title="Legal"
      framed
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
          {page.reviewRequestedAt ? (
            <Badge variant="secondary">Review requested</Badge>
          ) : page.hasDraft ? (
            <Badge variant="outline">Unpublished changes</Badge>
          ) : (
            <Badge variant="outline">Published</Badge>
          )}
          <ArrowRight aria-hidden className="text-muted-foreground size-4" />
        </Link>
      ))}
    </SettingsSection>
  );
}
