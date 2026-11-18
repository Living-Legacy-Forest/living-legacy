import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { type MediaUsage, getMediaUsage } from '@/server/media';

type Use = MediaUsage[number];

/** Opens the item where it is edited: the item itself where the page can, else its list. */
function UseLink({ use }: { use: Use }) {
  const text = use.label || 'Untitled';
  const className = 'text-primary underline-offset-4 hover:underline';
  switch (use.kind) {
    case 'post':
      return (
        <Link to="/posts/$postId" params={{ postId: use.id }} className={className}>
          {text}
        </Link>
      );
    case 'testimonial':
      return (
        <Link to="/testimonials" search={{ selected: use.id }} className={className}>
          {text}
        </Link>
      );
    case 'location':
      return (
        <Link to="/locations" search={{ selected: use.id }} className={className}>
          {text}
        </Link>
      );
    case 'media coverage item':
      return (
        <Link to="/media-coverage" search={{ selected: use.id }} className={className}>
          {text}
        </Link>
      );
    case 'team member':
      return (
        <Link to="/team" className={className}>
          {text}
        </Link>
      );
    case 'FAQ':
      return (
        <Link to="/faqs" className={className}>
          {text}
        </Link>
      );
    case 'event':
      return (
        <Link to="/events/$eventId" params={{ eventId: use.id }} className={className}>
          {text}
        </Link>
      );
    default:
      return <span>{text}</span>;
  }
}

const KIND_LABEL: Record<string, string> = {
  post: 'Post',
  testimonial: 'Testimonial',
  location: 'Location',
  'media coverage item': 'Media coverage',
  'team member': 'Team',
  FAQ: 'FAQ',
  event: 'Event',
};

/** Where an image is used, so nobody has to try deleting it to find out. */
export function MediaUsageList({ id }: { id: string }) {
  const [uses, setUses] = useState<MediaUsage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUses(null);
    setFailed(false);
    getMediaUsage({ data: { id } }).then(
      (found) => active && setUses(found),
      () => active && setFailed(true)
    );
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <section className="grid gap-2" aria-labelledby="m-usage">
      <h3 id="m-usage" className="text-sm font-medium">
        Used in
      </h3>
      {failed ? (
        <p className="text-muted-foreground text-sm">Could not check where this is used.</p>
      ) : uses === null ? (
        <Spinner />
      ) : uses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Not used anywhere yet.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {uses.map((use) => (
            <li key={`${use.kind}-${use.id}`} className="flex min-w-0 gap-2">
              <span className="text-muted-foreground w-28 shrink-0">
                {KIND_LABEL[use.kind] ?? use.kind}
              </span>
              <span className="min-w-0 truncate">
                <UseLink use={use} />
              </span>
              {use.count > 1 && (
                <span className="text-muted-foreground ml-auto shrink-0">{use.count} dates</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
