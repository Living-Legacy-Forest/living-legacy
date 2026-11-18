/**
 * The /about/in-the-media/ topic filter + grid. A single-select shadcn
 * ToggleGroup narrows the grid to one category; every item renders in the
 * server HTML regardless of the active filter; React state hides the rest
 * client-side only after this island hydrates, so with no JavaScript every
 * item stays visible. YouTube video cards keep the old click-to-load
 * behaviour: the iframe is only created once its play button is clicked.
 * Any other video link opens in a new tab, like a news card.
 *
 * Items come from the CMS (Media coverage); dates are formatted in the owning
 * .astro page, in the site's time zone.
 */
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon } from '@hugeicons/core-free-icons';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CARD_SIZES } from '@/lib/media-srcset';
import { cn } from '@/lib/utils';

export interface MediaItem {
  id: string;
  kind: 'article' | 'video';
  title: string;
  source: string;
  category: string | null;
  excerpt: string | null;
  /** e.g. "3 November 2026 · 4 min read", or null for neither. */
  meta: string | null;
  href: string;
  youtubeId: string | null;
  image: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    srcset?: string;
    position?: string;
  } | null;
  featured: boolean;
}

const ALL = 'all';

function PlayBadge() {
  return (
    <span className="bg-paper/90 group-hover:bg-paper relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors duration-200">
      <HugeiconsIcon icon={PlayIcon} className="text-ink ml-0.5 size-6" aria-hidden="true" />
    </span>
  );
}

function CardText({ item, as: Heading }: { item: MediaItem; as: 'h2' | 'h3' }) {
  return (
    <>
      <p className="eyebrow mt-4">
        {item.source} &middot; {item.kind === 'video' ? 'Video' : 'News'}
      </p>
      <Heading
        className={cn(
          'card-title group-hover:text-moss-deep mt-2 transition-colors duration-200',
          item.featured && 'lg:text-3xl'
        )}
      >
        {item.title}
      </Heading>
      {item.excerpt && <p className="text-ink-soft mt-2 text-base">{item.excerpt}</p>}
      {item.meta && <p className="text-ink-soft mt-2 text-sm">{item.meta}</p>}
    </>
  );
}

function VideoCard({ item }: { item: MediaItem & { youtubeId: string } }) {
  const [playing, setPlaying] = useState(false);
  const thumb = item.image?.src ?? `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`;

  return (
    <div className="group flex h-full flex-col">
      <div className="bg-ink ring-border relative aspect-video overflow-hidden rounded-2xl ring-1">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1`}
            title={`Play video: ${item.title}, ${item.source}`}
            className="absolute inset-0 h-full w-full"
            allow="accelerated-video; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            className="absolute inset-0 flex h-full w-full items-center justify-center"
            aria-label={`Play video: ${item.title}, ${item.source}`}
            onClick={() => setPlaying(true)}
          >
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
            />
            <PlayBadge />
          </button>
        )}
      </div>
      <CardText item={item} as="h2" />
    </div>
  );
}

/** A news article, or a video hosted somewhere other than YouTube. */
function LinkCard({ item }: { item: MediaItem }) {
  const video = item.kind === 'video';
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl"
    >
      <div
        className={cn(
          'ring-border relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl ring-1',
          video ? 'bg-ink' : 'bg-moss/10'
        )}
      >
        {item.image ? (
          <img
            src={item.image.src}
            srcSet={item.image.srcset}
            sizes={item.image.srcset ? CARD_SIZES : undefined}
            width={item.image.width}
            height={item.image.height}
            alt={item.image.alt}
            style={item.image.position ? { objectPosition: item.image.position } : undefined}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          !video && (
            <span className="text-moss-deep font-heading px-6 text-center text-2xl">
              {item.source}
            </span>
          )
        )}
        {video && <PlayBadge />}
      </div>
      <CardText item={item} as="h2" />
      <span className="text-ink-soft group-hover:text-moss-deep mt-3 text-base font-medium underline underline-offset-4 transition-colors duration-200">
        {video ? 'Watch' : 'Read more'}
      </span>
    </a>
  );
}

export function MediaFilter({ items }: { items: MediaItem[] }) {
  const [filter, setFilter] = useState<string>(ALL);
  // Topics in the order they first appear; the filter only helps with two or more.
  const topics = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];

  return (
    <div>
      {topics.length > 1 && (
        <ToggleGroup
          variant="outline"
          value={[filter]}
          onValueChange={(value) => setFilter(value[0] ?? ALL)}
          aria-label="Filter by topic"
          className="flex-wrap"
        >
          <ToggleGroupItem value={ALL} aria-label="All">
            All
          </ToggleGroupItem>
          {topics.map((topic) => (
            <ToggleGroupItem key={topic} value={topic} aria-label={topic}>
              {topic}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const visible = filter === ALL || item.category === filter;
          return (
            <li
              key={item.id}
              hidden={!visible}
              className={cn('flex flex-col', item.featured && 'sm:col-span-2')}
            >
              {item.youtubeId ? (
                <VideoCard item={{ ...item, youtubeId: item.youtubeId }} />
              ) : (
                <LinkCard item={item} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
