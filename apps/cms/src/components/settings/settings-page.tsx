import { SEO_DESCRIPTION_LIMIT } from '@llf/content';
import { useState } from 'react';
import { GlobeIcon, MailIcon, SunMoonIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type Locale, type SiteSettings, type Theme, saveSiteSettings } from '@/server/settings';

const localeItems: { value: Locale; label: string }[] = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
];

const themeItems: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Match visitor device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsPage({ data }: { data: SiteSettings }) {
  const [values, setValues] = useState(data);
  const { run, pending } = useAction();

  const patch = (next: Partial<SiteSettings>) => setValues((v) => ({ ...v, ...next }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(
      () => saveSiteSettings({ data: values }),
      'Settings saved.'
    );
    if (result) setValues(result);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Site-wide details used across the CMS and, eventually, the public website.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailIcon aria-hidden className="size-4" />
              General
            </CardTitle>
            <CardDescription>What the site is called and how people reach you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-title">Site title</Label>
              <Input
                id="s-title"
                required
                value={values.siteTitle}
                onChange={(e) => patch({ siteTitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-tagline">Tagline</Label>
              <Input
                id="s-tagline"
                value={values.tagline}
                placeholder="Transforming grief into growth"
                onChange={(e) => patch({ tagline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Contact email</Label>
              <Input
                id="s-email"
                type="email"
                value={values.contactEmail}
                placeholder="hello@livinglegacyforest.com.au"
                onChange={(e) => patch({ contactEmail: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social links</CardTitle>
            <CardDescription>Shown in the website footer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-facebook">Facebook</Label>
              <Input
                id="s-facebook"
                type="url"
                value={values.facebookUrl}
                placeholder="https://www.facebook.com/…"
                onChange={(e) => patch({ facebookUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-instagram">Instagram</Label>
              <Input
                id="s-instagram"
                type="url"
                value={values.instagramUrl}
                placeholder="https://www.instagram.com/…"
                onChange={(e) => patch({ instagramUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-youtube">YouTube</Label>
              <Input
                id="s-youtube"
                type="url"
                value={values.youtubeUrl}
                placeholder="https://www.youtube.com/…"
                onChange={(e) => patch({ youtubeUrl: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search &amp; sharing defaults</CardTitle>
            <CardDescription>
              Used when a page doesn't set its own description or preview image.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CountedField
              id="s-seo-description"
              label="Default description"
              value={values.seoDescription}
              limit={SEO_DESCRIPTION_LIMIT}
              placeholder="Summarise the site in a sentence or two."
              onChange={(seoDescription) => patch({ seoDescription })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="s-seo-image">Default share image</Label>
              <Input
                id="s-seo-image"
                type="url"
                value={values.seoImageUrl}
                placeholder="https://…/share-image.jpg"
                onChange={(e) => patch({ seoImageUrl: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GlobeIcon aria-hidden className="size-4" />
              <SunMoonIcon aria-hidden className="size-4" />
              Language &amp; appearance
            </CardTitle>
            <CardDescription>The site's language and its default colour theme.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-locale">Language</Label>
              <Select
                items={localeItems}
                value={values.locale}
                onValueChange={(value) => value && patch({ locale: value as Locale })}
              >
                <SelectTrigger id="s-locale" className="w-full">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-theme">Theme</Label>
              <Select
                items={themeItems}
                value={values.theme}
                onValueChange={(value) => value && patch({ theme: value as Theme })}
              >
                <SelectTrigger id="s-theme" className="w-full">
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
            </div>
          </CardContent>
        </Card>

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

function CountedField({
  id,
  label,
  value,
  limit,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  limit: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const over = value.length > limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn('text-muted-foreground text-xs tabular-nums', over && 'text-destructive')}
        >
          {value.length}/{limit}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
