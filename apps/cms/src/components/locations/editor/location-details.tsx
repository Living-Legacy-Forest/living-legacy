import {
  type AustralianState,
  type LocationStage,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  australianStateLabels,
  locationStageLabels,
} from '@ll/content';
import { FormCell, FormSwitchCell } from '@/components/form-cells';
import { ImageField } from '@/components/media/image-field';
import { CountedField, SITE_HOST } from '@/components/posts/post-editor/seo-fields';
import { Input } from '@/components/ui/input';
import { WholeNumberInput } from '@/components/ui/whole-number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LocationEditorState } from './use-location-editor';

const stateItems = (Object.keys(australianStateLabels) as AustralianState[]).map((value) => ({
  value,
  label: australianStateLabels[value],
}));

const stageItems = (Object.keys(locationStageLabels) as LocationStage[]).map((value) => ({
  value,
  label: locationStageLabels[value],
}));

const stageHints: Record<LocationStage, string> = {
  live: 'Has its own page on this website, at the address below.',
  external: 'Listed in the directory, linking to its current website until it moves here.',
  coming_soon: 'Listed in the directory as coming soon, with no page to visit.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 border-b pb-6 last:border-b-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Everything about a location that is not its story: publishing, listing, place, visiting details. */
export function LocationDetails({ editor }: { editor: LocationEditorState }) {
  const { values, patch } = editor;
  return (
    <div className="space-y-6 [--form-gap:1rem]">
      <Section title="Publishing">
        <FormSwitchCell
          id="loc-published"
          label="Published"
          description="Show this on the website."
          checked={values.published}
          onCheckedChange={(published) => patch({ published })}
        />
      </Section>

      <Section title="Listing">
        <FormCell label="Stage" htmlFor="loc-stage" hint={stageHints[values.stage]}>
          <Select
            items={stageItems}
            value={values.stage}
            onValueChange={(v) => v && patch({ stage: v as LocationStage })}
          >
            <SelectTrigger id="loc-stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stageItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormCell>
        {values.stage === 'external' && (
          <FormCell
            label="Current website"
            htmlFor="loc-external"
            hint="Where the directory sends visitors until this location moves here."
          >
            <Input
              id="loc-external"
              type="url"
              maxLength={500}
              value={values.externalUrl}
              onChange={(e) => patch({ externalUrl: e.target.value })}
              placeholder="https://"
            />
          </FormCell>
        )}
      </Section>

      <Section title="Place">
        <FormCell label="State" htmlFor="loc-state">
          <Select
            items={stateItems}
            value={values.state}
            onValueChange={(v) => v && patch({ state: v as AustralianState })}
          >
            <SelectTrigger id="loc-state" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormCell>
        <FormCell label="Region" htmlFor="loc-region">
          <Input
            id="loc-region"
            maxLength={80}
            value={values.region}
            onChange={(e) => patch({ region: e.target.value })}
            placeholder="Optional, e.g. a nearby town"
          />
        </FormCell>
        <p className="text-muted-foreground text-xs">
          The state filters the directory; it is never a page of its own.
        </p>
      </Section>

      <Section title="Visiting">
        <FormCell label="Map link" htmlFor="loc-map" hint="The Share link from Google Maps.">
          <Input
            id="loc-map"
            type="url"
            maxLength={500}
            value={values.mapUrl}
            onChange={(e) => patch({ mapUrl: e.target.value })}
            placeholder="https://"
          />
        </FormCell>
        <FormCell label="Hours" htmlFor="loc-hours" hint="One line per day or range.">
          <Textarea
            id="loc-hours"
            rows={3}
            maxLength={400}
            value={values.hours}
            onChange={(e) => patch({ hours: e.target.value })}
            placeholder={'Monday to Friday, 9am to 5pm\nWeekends by appointment'}
          />
        </FormCell>
        <FormCell label="Phone" htmlFor="loc-phone">
          <Input
            id="loc-phone"
            type="tel"
            maxLength={40}
            value={values.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="Phone number"
          />
        </FormCell>
        <FormCell label="Email" htmlFor="loc-email">
          <Input
            id="loc-email"
            type="email"
            maxLength={120}
            value={values.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="name@example.com"
          />
        </FormCell>
      </Section>

      <Section title="On the website">
        <FormCell
          label="Slug"
          htmlFor="loc-slug"
          hint={
            <>
              Its page lives at /locations/{values.slug || 'slug'}/. Keep it short, e.g. the town
              name.
            </>
          }
        >
          <Input
            id="loc-slug"
            maxLength={80}
            value={values.slug}
            onChange={(e) => editor.setSlug(e.target.value)}
            onBlur={editor.settleSlug}
            placeholder="made-from-the-name"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="md:text-ui font-mono"
          />
        </FormCell>
      </Section>

      <Section title="Search and sharing">
        <div className="space-y-0.5 rounded-md border p-3">
          <p className="text-muted-foreground truncate text-xs">
            {SITE_HOST} › locations › {values.slug || '…'}
          </p>
          <p className="line-clamp-2 font-medium">
            {values.seoTitle || values.name || 'Location name'}
          </p>
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {values.seoDescription || values.intro || 'Add an introduction to control this text.'}
          </p>
        </div>
        <CountedField
          id="loc-seo-title"
          label="Title"
          value={values.seoTitle}
          limit={SEO_TITLE_LIMIT}
          placeholder={values.name}
          onChange={(seoTitle) => patch({ seoTitle })}
        />
        <CountedField
          id="loc-seo-description"
          label="Description"
          value={values.seoDescription}
          limit={SEO_DESCRIPTION_LIMIT}
          placeholder={values.intro || 'Summarise this location in a sentence or two.'}
          multiline
          onChange={(seoDescription) => patch({ seoDescription })}
        />
        <ImageField
          id="loc-share-image"
          aspect={1.91}
          label="Share image"
          description="Uses the hero photo if left empty."
          mediaId={values.ogMediaId}
          onChange={(ogMediaId) => patch({ ogMediaId })}
        />
        <FormSwitchCell
          id="loc-noindex"
          label="Hide from search engines"
          description="Keeps its page out of search results and the sitemap."
          checked={values.noindex}
          onCheckedChange={(noindex) => patch({ noindex })}
        />
        <p className="text-muted-foreground text-xs">
          Only locations that are live on this site have a page to describe.
        </p>
      </Section>

      <Section title="Other">
        <FormCell
          label="HubSpot form ID"
          htmlFor="loc-form"
          hint="Found in HubSpot under the form’s embed code. Tour bookings and enquiries from its page go to this form, so they reach this location’s team. Blank uses the general enquiry form."
        >
          <Input
            id="loc-form"
            maxLength={36}
            value={values.hubspotFormId}
            onChange={(e) => patch({ hubspotFormId: e.target.value })}
            placeholder="Optional"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="md:text-ui font-mono"
          />
        </FormCell>
        <FormCell
          label="Order"
          htmlFor="loc-order"
          hint="Lower numbers come first in the directory."
        >
          <WholeNumberInput
            id="loc-order"
            min={0}
            max={9999}
            value={values.sortOrder}
            onValueChange={(sortOrder) => patch({ sortOrder })}
            className="w-28"
          />
        </FormCell>
      </Section>
    </div>
  );
}
