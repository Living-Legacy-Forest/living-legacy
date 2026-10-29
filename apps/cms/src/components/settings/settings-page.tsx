import { SEO_DESCRIPTION_LIMIT } from '@llf/content';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type Locale, type SiteSettings, type Theme, saveSiteSettings } from '@/server/settings';

const localeItems: { value: Locale; label: string }[] = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
];

const themeItems: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System preference' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsPage({ data }: { data: SiteSettings }) {
  const [values, setValues] = useState(data);
  const { run, pending } = useAction();

  const patch = (next: Partial<SiteSettings>) => setValues((v) => ({ ...v, ...next }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => saveSiteSettings({ data: values }), 'Settings saved.');
    if (result) setValues(result);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Site-wide details used across the CMS and, eventually, the public website.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-8">
        <SettingsSection title="General" description="What the site is called and how people reach you.">
          <SettingsRow title="Site title">
            <Input
              required
              value={values.siteTitle}
              onChange={(e) => patch({ siteTitle: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
          <SettingsRow title="Tagline">
            <Input
              value={values.tagline}
              placeholder="Transforming grief into growth"
              onChange={(e) => patch({ tagline: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
          <SettingsRow title="Contact email">
            <Input
              type="email"
              value={values.contactEmail}
              placeholder="hello@livinglegacyforest.com.au"
              onChange={(e) => patch({ contactEmail: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Social links" description="Shown in the website footer.">
          <SettingsRow title="Facebook">
            <Input
              type="url"
              value={values.facebookUrl}
              placeholder="https://www.facebook.com/…"
              onChange={(e) => patch({ facebookUrl: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
          <SettingsRow title="Instagram">
            <Input
              type="url"
              value={values.instagramUrl}
              placeholder="https://www.instagram.com/…"
              onChange={(e) => patch({ instagramUrl: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
          <SettingsRow title="YouTube">
            <Input
              type="url"
              value={values.youtubeUrl}
              placeholder="https://www.youtube.com/…"
              onChange={(e) => patch({ youtubeUrl: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="Search & sharing defaults"
          description="Used when a page doesn't set its own description or preview image."
        >
          <SettingsRow
            title="Default description"
            suffix={
              <span
                className={cn(
                  'text-muted-foreground text-xs tabular-nums',
                  values.seoDescription.length > SEO_DESCRIPTION_LIMIT && 'text-destructive'
                )}
              >
                {values.seoDescription.length}/{SEO_DESCRIPTION_LIMIT}
              </span>
            }
            stacked
          >
            <Textarea
              value={values.seoDescription}
              placeholder="Summarise the site in a sentence or two."
              rows={2}
              onChange={(e) => patch({ seoDescription: e.target.value })}
              className={cn(
                values.seoDescription.length > SEO_DESCRIPTION_LIMIT && 'border-destructive'
              )}
            />
          </SettingsRow>
          <SettingsRow title="Default share image">
            <Input
              type="url"
              value={values.seoImageUrl}
              placeholder="https://…/share-image.jpg"
              onChange={(e) => patch({ seoImageUrl: e.target.value })}
              className="w-64"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="Language & appearance"
          description="The site's language and its default colour theme."
        >
          <SettingsRow title="Language">
            <Select
              items={localeItems}
              value={values.locale}
              onValueChange={(value) => value && patch({ locale: value as Locale })}
            >
              <SelectTrigger className="w-48">
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
          <SettingsRow title="Theme">
            <Select
              items={themeItems}
              value={values.theme}
              onValueChange={(value) => value && patch({ theme: value as Theme })}
            >
              <SelectTrigger className="w-48">
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

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
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
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <div className="divide-y rounded-lg border">{children}</div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  suffix,
  stacked = false,
  children,
}: {
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
          <p className="text-sm font-medium">{title}</p>
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
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
