import { FormBlock, FormCell, FormSection } from '@/components/form-cells';
import { ImageField } from '@/components/media/image-field';
import { RichTextField } from '@/components/rich-text-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LocationDetails } from './location-details';
import type { LocationEditorState } from './use-location-editor';

/**
 * The place itself, the way a post's body is the centre of its page: the photo,
 * name and intro, then About and the address, then every other detail. The map
 * sits beside it (location-map-panel.tsx).
 */
export function LocationMain({ editor }: { editor: LocationEditorState }) {
  const { values, patch } = editor;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 [--form-gap:1.25rem] max-md:space-y-7 max-md:px-4">
      <ImageField
        id="loc-hero"
        label="Hero photo"
        headerClassName="max-md:px-4"
        description="A genuine photo of this location, never a generic one."
        mediaId={values.heroMediaId}
        onChange={(heroMediaId) => patch({ heroMediaId })}
      />

      <FormSection>
        <FormCell label="Name" htmlFor="loc-name" hint="The public name, as it appears on signage.">
          <Input
            id="loc-name"
            required
            maxLength={120}
            value={values.name}
            onChange={(e) => editor.setName(e.target.value)}
            placeholder="The location’s public name"
          />
        </FormCell>
        <FormCell
          label="Intro"
          htmlFor="loc-intro"
          hint="A sentence or two for its card in the directory."
        >
          <Textarea
            id="loc-intro"
            rows={4}
            maxLength={400}
            value={values.intro}
            onChange={(e) => patch({ intro: e.target.value })}
            placeholder="What makes this place special, in a sentence or two"
          />
        </FormCell>
      </FormSection>

      <FormBlock
        label="About"
        labelId="loc-about-label"
        htmlFor="loc-about"
        hint="The local introduction on its page: the landscape, trees and what a visit is like."
      >
        <RichTextField
          id="loc-about"
          labelId="loc-about-label"
          value={values.about}
          onChange={(about) => patch({ about })}
          placeholder="Tell visitors about this place and what to expect when they visit"
          contentClassName="[&_.ProseMirror]:min-h-80!"
        />
      </FormBlock>

      <section aria-label="Where" className="space-y-5 pt-8 max-md:pt-0">
        <h2 className="text-base font-semibold max-md:px-4 max-md:text-[1.0625rem]">Where</h2>
        <FormSection>
          <FormCell label="Address" htmlFor="loc-address">
            <Input
              id="loc-address"
              maxLength={200}
              value={values.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="Street, suburb, state and postcode"
            />
          </FormCell>
        </FormSection>
      </section>

      <section aria-label="Details" className="space-y-5 pt-8 max-md:pt-0">
        <h2 className="text-base font-semibold max-md:px-4 max-md:text-[1.0625rem]">Details</h2>
        <LocationDetails editor={editor} />
      </section>
    </div>
  );
}
