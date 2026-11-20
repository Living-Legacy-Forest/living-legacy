import {
  FOCUS_KEYWORD_LIMIT,
  type PostInput,
  RELATED_TERMS_MAX,
  RELATED_TERM_LIMIT,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
} from '@ll/content';
import type { ReactNode } from 'react';
import { SuggestButton } from '@/components/ai/suggest-button';
import { suggestPostText } from '@/components/ai/post-suggestions';
import { ImageField } from '@/components/media/image-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { TermsInput } from './terms-input';

export const SITE_HOST = 'livinglegacy.com.au';

/** The search listing: a preview of the result, then the fields behind it. */
export function SeoFields({
  values,
  onChange,
}: {
  values: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}) {
  const title = values.seoTitle || values.title || 'Post title';
  const description = values.seoDescription || values.excerpt;
  const ownUrl = `https://${SITE_HOST}/blog/${values.slug || '…'}/`;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5 rounded-md border p-3">
        <p className="text-muted-foreground truncate text-xs">
          {SITE_HOST} › blog › {values.slug || '…'}
        </p>
        <p className="line-clamp-2 font-medium">{title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {values.nosnippet
            ? 'No description: search engines are asked not to show one.'
            : description || 'Add a summary or description to control this text.'}
        </p>
      </div>
      <CountedField
        id="seo-title"
        label="Title"
        value={values.seoTitle}
        limit={SEO_TITLE_LIMIT}
        placeholder={values.title}
        onChange={(seoTitle) => onChange({ seoTitle })}
        action={
          <SuggestButton
            value={values.seoTitle}
            request={() => suggestPostText('seoTitle', values)}
            onApply={(seoTitle) => onChange({ seoTitle })}
          />
        }
      />
      <CountedField
        id="seo-description"
        label="Description"
        value={values.seoDescription}
        limit={SEO_DESCRIPTION_LIMIT}
        placeholder={values.excerpt || 'Summarise the post in a sentence or two.'}
        multiline
        onChange={(seoDescription) => onChange({ seoDescription })}
        action={
          <SuggestButton
            value={values.seoDescription}
            request={() => suggestPostText('seoDescription', values)}
            onApply={(seoDescription) => onChange({ seoDescription })}
          />
        }
      />
      <div className="space-y-1">
        <CountedField
          id="seo-focus-keyword"
          label="Focus keyword"
          value={values.focusKeyword}
          limit={FOCUS_KEYWORD_LIMIT}
          placeholder="The phrase people search for"
          onChange={(focusKeyword) => onChange({ focusKeyword })}
          action={
            <SuggestButton
              value={values.focusKeyword}
              request={() => suggestPostText('focusKeyword', values)}
              onApply={(focusKeyword) => onChange({ focusKeyword })}
            />
          }
        />
        <p className="text-muted-foreground text-xs">Used only for the content score.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="seo-related-terms" className="text-muted-foreground text-xs font-normal">
          Related terms
        </Label>
        <TermsInput
          id="seo-related-terms"
          terms={values.relatedTerms}
          max={RELATED_TERMS_MAX}
          maxLength={RELATED_TERM_LIMIT}
          placeholder="Type a term, then press Enter"
          onChange={(relatedTerms) => onChange({ relatedTerms })}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs font-medium">Advanced</p>
        <div className="space-y-1.5">
          <Label htmlFor="seo-canonical" className="text-muted-foreground text-xs font-normal">
            Canonical URL
          </Label>
          <Input
            id="seo-canonical"
            type="url"
            maxLength={500}
            inputMode="url"
            value={values.canonicalUrl}
            placeholder={ownUrl}
            onChange={(e) => onChange({ canonicalUrl: e.target.value })}
            className="text-ui md:text-ui h-8"
          />
          <p className="text-muted-foreground text-xs">
            Only if this post first appeared elsewhere. Search engines then credit that page, and
            the post leaves the sitemap.
          </p>
        </div>
        <RobotsSwitch
          id="seo-noindex"
          label="Hide from search engines"
          checked={values.noindex}
          onChange={(noindex) => onChange({ noindex })}
        />
        {/* Hidden posts already ask search engines not to follow their links, and the rest only matter once a post is listed. */}
        <RobotsSwitch
          id="seo-nofollow"
          label="Don’t follow links in this post"
          checked={values.noindex || values.nofollow}
          disabled={values.noindex}
          onChange={(nofollow) => onChange({ nofollow })}
        />
        <RobotsSwitch
          id="seo-nosnippet"
          label="Don’t show a text snippet"
          checked={values.nosnippet}
          disabled={values.noindex}
          onChange={(nosnippet) => onChange({ nosnippet })}
        />
        <RobotsSwitch
          id="seo-noimageindex"
          label="Keep images out of image search"
          checked={values.noimageindex}
          disabled={values.noindex}
          onChange={(noimageindex) => onChange({ noimageindex })}
        />
      </div>
    </div>
  );
}

function RobotsSwitch({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className={cn('text-ui font-normal', disabled && 'opacity-50')}>
        {label}
      </Label>
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/** How the post looks when shared: a preview of the card, then its own wording and image. */
export function SocialFields({
  values,
  onChange,
}: {
  values: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}) {
  const searchTitle = values.seoTitle || values.title;
  const searchDescription = values.seoDescription || values.excerpt;
  const title = values.socialTitle || searchTitle || 'Post title';
  const description = values.socialDescription || searchDescription;
  const imageId = values.ogMediaId ?? values.featuredMediaId;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted aspect-[1.91] w-full">
          {imageId && (
            <img
              src={`/api/media/${imageId}?w=640`}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="space-y-0.5 border-t p-3">
          <p className="text-muted-foreground truncate text-xs">{SITE_HOST}</p>
          <p className="line-clamp-2 font-medium">{title}</p>
          {description && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{description}</p>
          )}
        </div>
      </div>
      <CountedField
        id="social-title"
        label="Title"
        value={values.socialTitle}
        limit={SEO_TITLE_LIMIT}
        placeholder={searchTitle}
        onChange={(socialTitle) => onChange({ socialTitle })}
      />
      <CountedField
        id="social-description"
        label="Description"
        value={values.socialDescription}
        limit={SEO_DESCRIPTION_LIMIT}
        placeholder={searchDescription || 'Uses the search description if left empty.'}
        multiline
        onChange={(socialDescription) => onChange({ socialDescription })}
      />
      <ImageField
        id="seo-share-image"
        aspect={1.91}
        label="Share image"
        description="Uses the featured image if left empty."
        mediaId={values.ogMediaId}
        onChange={(ogMediaId) => onChange({ ogMediaId })}
      />
    </div>
  );
}

export function CountedField({
  id,
  label,
  value,
  limit,
  placeholder,
  multiline = false,
  onChange,
  action,
}: {
  id: string;
  label: string;
  value: string;
  limit: number;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  /** A control beside the count, such as a Suggest button. */
  action?: ReactNode;
}) {
  const over = value.length > limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          {action}
          <span
            className={cn('text-muted-foreground text-xs tabular-nums', over && 'text-destructive')}
          >
            {value.length}/{limit}
          </span>
        </div>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="text-ui md:text-ui"
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-ui md:text-ui h-8"
        />
      )}
    </div>
  );
}
