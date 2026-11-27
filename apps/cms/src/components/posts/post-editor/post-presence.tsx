// Tells you when someone else has this post open, and when they saved it after
// you loaded it, before you save over their work. Saves already refuse to
// overwrite a newer version; this says so sooner. Nothing is locked.
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { avatarSrc, initialsOf } from '@/lib/avatar';
import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { type Presence, checkInToPost, checkOutOfPost } from '@/server/post-presence';

/** How often an open editor checks in. Others count it gone after a minute. */
const CHECK_IN_MS = 20_000;

const nobody: Presence = { others: [], newerSave: null };

/**
 * Checks in while the post is open and the tab is showing, and out when it
 * closes. `since` is when this editor last loaded or saved the post.
 */
export function usePostPresence(postId: string | null, since: number | undefined): Presence {
  const [presence, setPresence] = useState(nobody);
  const sinceRef = useRef<number | null>(since ?? null);
  sinceRef.current = since ?? null;

  useEffect(() => {
    if (!postId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      clearTimeout(timer);
      // A hidden tab is not being edited, so it stops checking in and drops off.
      if (document.visibilityState === 'visible') {
        try {
          const found = await checkInToPost({ data: { postId, since: sinceRef.current } });
          if (!stopped) setPresence(found);
        } catch {
          // Offline for a moment: try again next time.
        }
      }
      if (!stopped) timer = setTimeout(tick, CHECK_IN_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      void checkOutOfPost({ data: { postId } }).catch(() => {});
    };
  }, [postId]);

  // Saving here moves `since` on, so a notice about an older save clears at once.
  useEffect(() => {
    setPresence((p) =>
      p.newerSave && since !== undefined && p.newerSave.at <= since ? { ...p, newerSave: null } : p
    );
  }, [since]);

  return presence;
}

const names = (list: string[]) =>
  list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

export function PresenceNotice({
  presence,
  dirty,
  onReload,
}: {
  presence: Presence;
  /** This editor has unsaved changes, which reloading would lose. */
  dirty: boolean;
  onReload: () => void;
}) {
  const zone = useTimeZone();
  const { others, newerSave } = presence;
  if (!newerSave && others.length === 0) return null;

  return (
    <div
      role="status"
      className={
        newerSave
          ? 'flex flex-wrap items-center gap-x-3 gap-y-2 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200'
          : 'bg-muted/50 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm'
      }
    >
      {others.length > 0 && (
        <AvatarGroup>
          {others.slice(0, 3).map((o) => (
            <Avatar key={o.id} size="sm">
              <AvatarImage src={avatarSrc(o)} alt="" />
              <AvatarFallback>{initialsOf(o.name)}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      )}
      <p className="min-w-0 flex-1">
        {newerSave ? (
          <>
            {newerSave.name} saved changes at {formatDateTime(newerSave.at, zone)}. Reload to see
            them before you save
            {dirty
              ? '; your unsaved changes here would be lost, so copy anything you need first.'
              : '.'}
          </>
        ) : (
          <>
            {names(others.map((o) => o.name))} {others.length === 1 ? 'is' : 'are'} also editing
            this post.
          </>
        )}
      </p>
      {newerSave && (
        <Button size="sm" variant="outline" onClick={onReload}>
          Reload
        </Button>
      )}
    </div>
  );
}
