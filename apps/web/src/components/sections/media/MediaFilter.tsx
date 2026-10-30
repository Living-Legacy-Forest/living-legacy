/**
 * The /about/in-the-media/ filter + grid. A single-select shadcn ToggleGroup
 * narrows the grid to one type; every item renders in the server HTML
 * regardless of the active filter; React state hides the rest client-side
 * only after this island hydrates, so with no JavaScript every item stays
 * visible. Video cards keep the old click-to-load behaviour: the YouTube
 * iframe is only created once its play button is clicked.
 *
 * Image URLs are pre-computed in the owning .astro page with getImage(),
 * since React islands cannot use astro:assets themselves.
 */
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon } from '@hugeicons/core-free-icons';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface NewsMediaItem {
  type: 'news';
  title: string;
  outlet: string;
  href: string;
  thumbSrc: string;
  thumbWidth: number;
  thumbHeight: number;
}

export interface VideoMediaItem {
  type: 'video';
  title: string;
  outlet: string;
  youtubeId: string;
}

export type MediaItem = NewsMediaItem | VideoMediaItem;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Video' },
  { key: 'news', label: 'News' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function VideoCard({ item }: { item: VideoMediaItem }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="bg-ink ring-border relative aspect-video overflow-hidden rounded-2xl ring-1">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1`}
            title={`Play video: ${item.title}, ${item.outlet}`}
            className="absolute inset-0 h-full w-full"
            allow="accelerated-video; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 flex h-full w-full items-center justify-center"
            aria-label={`Play video: ${item.title}, ${item.outlet}`}
            onClick={() => setPlaying(true)}
          >
            <img
              src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
            />
            <span className="bg-paper/90 group-hover:bg-paper relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors duration-200">
              <HugeiconsIcon
                icon={PlayIcon}
                className="text-ink ml-0.5 size-6"
                aria-hidden="true"
              />
            </span>
          </button>
        )}
      </div>
      <p className="eyebrow mt-4">{item.outlet} &middot; Video</p>
      <h2 className="card-title mt-2">{item.title}</h2>
    </div>
  );
}

function NewsCard({ item }: { item: NewsMediaItem }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl"
    >
      <div className="ring-border aspect-video overflow-hidden rounded-2xl ring-1">
        <img
          src={item.thumbSrc}
          width={item.thumbWidth}
          height={item.thumbHeight}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <p className="eyebrow mt-4">{item.outlet} &middot; News</p>
      <h2 className="card-title group-hover:text-moss-deep mt-2 transition-colors duration-200">
        {item.title}
      </h2>
      <span className="text-ink-soft group-hover:text-moss-deep mt-3 text-base font-medium underline underline-offset-4 transition-colors duration-200">
        Read more
      </span>
    </a>
  );
}

export function MediaFilter({ items }: { items: MediaItem[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');

  return (
    <div>
      <ToggleGroup
        variant="outline"
        value={[filter]}
        onValueChange={(value) => setFilter((value[0] as FilterKey) ?? 'all')}
        aria-label="Filter by type"
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f.key} value={f.key} aria-label={f.label}>
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const visible = filter === 'all' || item.type === filter;
          return (
            <li key={item.title} hidden={!visible} className="flex flex-col">
              {item.type === 'news' ? <NewsCard item={item} /> : <VideoCard item={item} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
