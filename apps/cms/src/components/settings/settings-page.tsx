import {
  SEO_DESCRIPTION_LIMIT,
  contentTargetProblem,
  contentTargetsFrom,
  isEmailDomain,
  isValidAbn,
  parseEmailDomains,
  sessionDayOptions,
  siteIconProblem,
} from '@ll/content';
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
import { ArrowRight } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  type Locale,
  type SiteSettings,
  TITLE_TOKENS,
  type Theme,
  type TimeZone,
  saveSiteSettings,
  timeZones,
} from '@/server/settings';

const rootRoute = getRouteApi('__root__');

const SITE_HOST = 'livinglegacy.com.au';

const sections = [
  { id: 'general', title: 'General' },
  { id: 'business', title: 'Contact & business' },
  { id: 'social', title: 'Social links' },
  { id: 'search', title: 'Search & sharing' },
  { id: 'content-targets', title: 'Content targets' },
  { id: 'legal', title: 'Legal' },
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

const themeLabels: Record<Theme, string> = {
  system: 'System preference',
  light: 'Light',
  dark: 'Dark',
};

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

const themeItems: { value: Theme; label: ReactNode }[] = (Object.keys(themeLabels) as Theme[]).map(
  (value) => ({
    value,
    label: (
      <span className="flex items-center gap-1.5">
        <ThemeSwatch theme={value} />
        <span className="text-[10px] font-semibold tracking-tight">Aa</span>
        {themeLabels[value]}
      </span>
    ),
  })
);

function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      className={cn(
        'ring-border inline-block size-2.5 shrink-0 rounded-full ring-1',
        theme === 'light' && 'bg-white',
        theme === 'dark' && 'bg-neutral-900',
        theme === 'system' && 'bg-[linear-gradient(135deg,white_50%,#171717_50%)]'
      )}
    />
  );
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
  return null;
}

export function SettingsPage({
  data,
  seoOnly = false,
  legalPages,
}: {
  data: SiteSettings;
  /** For SEO people: only the Search & sharing section. */
  seoOnly?: boolean;
  /** The legal pages, for people who can edit them; absent for everyone else. */
  legalPages?: LegalPageSummary[];
}) {
  const [saved, setSaved] = useState(data);
  const [values, setValues] = useState(data);
  const { run, pending } = useAction();
  const router = useRouter();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  // Preview the theme as soon as it's picked, not only once Save succeeds.
  useThemeSync(values.theme);

  // Leaving without saving must not leave an unsaved preview applied
  // app-wide, so restore whatever is actually persisted on unmount.
  const persistedTheme = rootRoute.useLoaderData().theme;
  const persistedThemeRef = useRef(persistedTheme);
  persistedThemeRef.current = persistedTheme;
  useEffect(() => () => setTheme(persistedThemeRef.current), []);

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
      // The root loader caches the theme and time zone; pick up the new ones.
      await router.invalidate();
    }
  }

  const exampleTitle = (values.titlePattern || TITLE_TOKENS.page)
    .replace(TITLE_TOKENS.page, 'Our story')
    .replace(TITLE_TOKENS.site, values.siteTitle);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Site-wide details used across the CMS and, once connected, the public website.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
        <SectionNav
          ids={sections
            .map((x) => x.id)
            .filter((id) =>
              id === 'legal'
                ? legalPages !== undefined
                : !seoOnly || id === 'search' || id === 'content-targets'
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
              />
              <SettingsRow
                id="settings-email"
                title="Contact email"
                description="Offered when a website form cannot send."
              >
                <Input
                  id="settings-email"
                  type="email"
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
            <div className="space-y-1.5 px-4 py-3.5">
              <p className="text-muted-foreground text-xs">Search result preview</p>
              <div className="rounded-md border px-4 py-3">
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
            <SettingsRow id="settings-target-words" title="Words">
              <TargetRange
                id="settings-target-words"
                noun="words"
                min={values.targetWordsMin}
                max={values.targetWordsMax}
                onChange={(min, max) => patch({ targetWordsMin: min, targetWordsMax: max })}
              />
            </SettingsRow>
            <SettingsRow id="settings-target-headings" title="Headings">
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
            <SettingsRow id="settings-target-images" title="Images">
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

          {legalPages && <LegalPagesSection pages={legalPages} />}

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
                  <SelectTrigger id="settings-session" className="w-40">
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
              description="The site's language, time zone and the CMS colour theme."
            >
              <SettingsRow id="settings-locale" title="Language">
                <Select
                  items={localeItems}
                  value={values.locale}
                  onValueChange={(value) => value && patch({ locale: value as Locale })}
                >
                  <SelectTrigger id="settings-locale" className="w-48">
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
                  <SelectTrigger id="settings-time-zone" className="w-56">
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
              <SettingsRow id="settings-theme" title="Theme">
                <Select
                  items={themeItems}
                  value={values.theme}
                  onValueChange={(value) => value && patch({ theme: value as Theme })}
                >
                  <SelectTrigger id="settings-theme" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeItems.map((item) => (
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
              'bg-background/95 sticky bottom-[calc(var(--tab-bar-height)+1rem)] z-10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-all',
              dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
            )}
            aria-hidden={!dirty}
          >
            <span className="mr-auto text-sm">You have unsaved changes.</span>
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
                'Save changes'
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
        ({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 120
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

  return (
    <nav aria-label="Settings sections" className="hidden lg:block">
      <ul className="sticky top-20 space-y-0.5">
        {shown.map((section) => (
          <li key={section.id}>
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
                'text-muted-foreground hover:text-foreground text-ui block rounded-md px-2.5 py-1.5 transition-colors',
                active === section.id && 'bg-muted text-foreground font-medium'
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
}: {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      className="touch:h-11 h-8 w-20 tabular-nums"
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
    <div className="flex items-center gap-2">
      <TargetInput
        id={id}
        label={`Fewest ${noun}`}
        value={min}
        onChange={(n) => onChange(n, max)}
      />
      <span className="text-muted-foreground text-xs">to</span>
      <TargetInput label={`Most ${noun}`} value={max} onChange={(n) => onChange(min, n)} />
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
 * The icon for browser tabs and home screens. Shown on its own and in a browser
 * tab, at the size people actually see it, with the built-in icon until one is
 * chosen.
 */
function SiteIconRow({
  mediaId,
  siteTitle,
  onChange,
}: {
  mediaId: string | null;
  siteTitle: string;
  onChange: (mediaId: string | null) => void;
}) {
  const { item, update } = useMediaItem(mediaId);
  const [picking, setPicking] = useState(false);
  const src = item ? `${item.url}?w=640` : '/icon-192.png';
  // Saving checks this too; saying so on picking saves a round trip.
  const problem = item ? siteIconProblem(item) : null;

  return (
    <SettingsRow
      id="settings-site-icon"
      title="Site icon"
      description="Shown in browser tabs, bookmarks and on phone home screens, for the website and the CMS. Use a square image at least 512 by 512 pixels; PNG works best."
      stacked
    >
      <div className="bg-muted/60 flex max-w-md items-center gap-4 rounded-lg border p-3">
        <img
          src={src}
          alt=""
          className="size-14 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/5"
        />
        <div
          aria-hidden
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-neutral-900 px-3 text-xs text-neutral-100 shadow-sm"
        >
          <span className="flex shrink-0 gap-1">
            <span className="size-2 rounded-full bg-neutral-600" />
            <span className="size-2 rounded-full bg-neutral-600" />
            <span className="size-2 rounded-full bg-neutral-600" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-neutral-700/80 px-2 py-1.5">
            <img src={src} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
            <span className="truncate">{siteTitle || 'Site title'}</span>
            <span className="ml-auto pl-1 text-neutral-400">×</span>
          </span>
        </div>
      </div>
      {problem && <p className="text-destructive text-xs">{problem}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button
          id="settings-site-icon"
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
          <span className="text-muted-foreground text-xs">Using the built-in icon.</span>
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
    </SettingsRow>
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

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3 max-md:space-y-1.5">
      {/* Phones: iOS Settings' small grey heading over an inset group. */}
      <div className="max-md:px-4">
        <h2 className="text-sm font-semibold max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs max-md:text-[0.8125rem]">
            {description}
          </p>
        )}
      </div>
      <div
        data-slot="settings-group"
        className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)"
      >
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  id,
  title,
  description,
  suffix,
  stacked = false,
  children,
}: {
  /** The field's id, so the title labels it (and error toasts can name it). */
  id: string;
  title: string;
  description?: string;
  suffix?: ReactNode;
  stacked?: boolean;
  children: ReactNode;
}) {
  if (stacked) {
    return (
      <div data-slot="settings-row" data-stacked="" className="space-y-1.5 px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{title}</Label>
          {suffix}
        </div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
        {children}
      </div>
    );
  }

  return (
    // Phones: a form cell's layout, the label left and the value right with the
    // description under the row (styles.css, settings-row).
    <div
      data-slot="settings-row"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 max-md:grid max-md:grid-cols-[fit-content(50%)_minmax(0,1fr)] max-md:gap-y-0 max-md:py-0"
    >
      <div className="min-w-0 flex-1 space-y-0.5 max-md:contents">
        <Label htmlFor={id}>{title}</Label>
        {description && (
          <p className="text-muted-foreground text-xs max-md:col-span-2 max-md:row-start-2">
            {description}
          </p>
        )}
      </div>
      <div
        data-slot="settings-control"
        className="w-full shrink-0 max-md:col-start-2 max-md:row-start-1 max-md:flex max-md:min-w-0 max-md:justify-end sm:w-auto"
      >
        {children}
      </div>
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
