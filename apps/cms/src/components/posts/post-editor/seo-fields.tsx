import {
  FOCUS_KEYWORD_LIMIT,
  type PostInput,
  RELATED_TERMS_MAX,
  RELATED_TERM_LIMIT,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
} from '@ll/content';
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

  return (
    <div className="space-y-4">
      <div className="space-y-0.5 rounded-md border p-3">
        <p className="text-muted-foreground truncate text-xs">
          {SITE_HOST} › blog › {values.slug || '…'}
        </p>
        <p className="line-clamp-2 font-medium">{title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {description || 'Add a summary or description to control this text.'}
        </p>
      </div>
      <CountedField
        id="seo-title"
        label="Title"
        value={values.seoTitle}
        limit={SEO_TITLE_LIMIT}
        placeholder={values.title}
        onChange={(seoTitle) => onChange({ seoTitle })}
      />
      <CountedField
        id="seo-description"
        label="Description"
        value={values.seoDescription}
        limit={SEO_DESCRIPTION_LIMIT}
        placeholder={values.excerpt || 'Summarise the post in a sentence or two.'}
        multiline
        onChange={(seoDescription) => onChange({ seoDescription })}
      />
      <div className="space-y-1">
        <CountedField
          id="seo-focus-keyword"
          label="Focus keyword"
          value={values.focusKeyword}
          limit={FOCUS_KEYWORD_LIMIT}
          placeholder="The phrase people search for"
          onChange={(focusKeyword) => onChange({ focusKeyword })}
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
      <ImageField
        id="seo-share-image"
        aspect={1.91}
        label="Share image"
        description="Shown when the post is shared on social media. Uses the featured image if left empty."
        mediaId={values.ogMediaId}
        onChange={(ogMediaId) => onChange({ ogMediaId })}
      />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="seo-noindex" className="text-ui font-normal">
          Hide from search engines
        </Label>
        <Switch
          id="seo-noindex"
          aria-label="Hide from search engines"
          checked={values.noindex}
          onCheckedChange={(noindex) => onChange({ noindex })}
        />
      </div>
    </div>
  );
}

function CountedField({
  id,
  label,
  value,
  limit,
  placeholder,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  limit: number;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const over = value.length > limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
          {label}
        </Label>
        <span
          className={cn('text-muted-foreground text-xs tabular-nums', over && 'text-destructive')}
        >
          {value.length}/{limit}
        </span>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="text-ui"
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-ui h-8"
        />
      )}
    </div>
  );
}
