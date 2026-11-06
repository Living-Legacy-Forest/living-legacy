import { SEO_DESCRIPTION_LIMIT, isValidAbn } from '@ll/content';
import { getRouteApi, useBlocker, useRouter } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { reportInvalid } from '@/lib/form-validation';
import { zoneOffset } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { setTheme, useThemeSync } from '@/lib/use-theme-sync';
import { cn } from '@/lib/utils';
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
  { id: 'appearance', title: 'Language & appearance' },
] as const;

const localeItems: { value: Locale; label: string }[] = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
];

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
  if (v.titlePattern && !v.titlePattern.includes(TITLE_TOKENS.page)) {
    return {
      field: 'settings-title-pattern',
      message: `The title pattern needs ${TITLE_TOKENS.page} where the page's own title goes.`,
    };
  }
  return null;
}

export function SettingsPage({
  data,
  seoOnly = false,
}: {
  data: SiteSettings;
  /** For SEO people: only the Search & sharing section. */
  seoOnly?: boolean;
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
      toast.error(issue.message);
      document.getElementById(issue.field)?.focus();
      return;
    }
    const result = await run(() => saveSiteSettings({ data: values }), 'Settings saved.');
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
        <SectionNav ids={seoOnly ? ['search'] : sections.map((x) => x.id)} />

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
 */
function scrollToSection(id: string) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${id}`);
}

/** Jump links to each section; the one in view is highlighted. Desktop only. */
function SectionNav({ ids }: { ids: string[] }) {
  const shown = sections.filter((section) => ids.includes(section.id));
  const [active, setActive] = useState<string>(shown[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      // A section counts as current once its top passes just under the header.
      { rootMargin: '-80px 0px -70% 0px' }
    );
    for (const { id } of shown) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
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
                scrollToSection(section.id);
                setActive(section.id);
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
    <section id={id} className="scroll-mt-20 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <div className="divide-y rounded-lg border">{children}</div>
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
      <div className="space-y-1.5 px-4 py-3.5">
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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id}>{title}</Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div className="w-full shrink-0 sm:w-auto">{children}</div>
    </div>
  );
}
