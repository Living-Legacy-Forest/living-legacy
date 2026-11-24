import { MEDIA_TRASH_DAYS } from '@ll/content';
import { toast } from 'sonner';
import { readableError } from './errors';
import { play } from './sound';

// Every toast has a heading (what happened) and a line under it (what that
// means, or why it failed). The types make both required, and ESLint keeps
// `sonner` from being used directly elsewhere.

export type Notice = {
  title: string;
  description: string;
  /** A button on the toast, such as Undo. */
  action?: { label: string; onClick: () => void };
  /** Replaces an earlier toast with the same id (a loading toast, say). */
  id?: string | number;
};

type Options = Pick<Notice, 'id'>;

function show(kind: 'success' | 'info' | 'warning', { title, ...rest }: Notice) {
  // Played on the outcome, not the click, so a failed save never sounds like a saved one.
  if (kind === 'success') play('success');
  return toast[kind](title, rest);
}

export const notify = {
  success: (notice: Notice) => show('success', notice),
  info: (notice: Notice) => show('info', notice),
  warning: (notice: Notice) => show('warning', notice),
  loading: ({ title, ...rest }: Notice) => toast.loading(title, rest),
  /**
   * `title` says what failed. `reason` is a sentence, or an error whose
   * message (made readable) becomes the description.
   */
  error: (title: string, reason: unknown, options?: Options) => {
    play('error');
    return toast.error(title, {
      description: typeof reason === 'string' ? reason : readableError(reason),
      ...options,
    });
  },
};

/** "Team member deleted", "3 team members deleted": the word matches the Delete button. */
function deletedTitle(count: number, [one, many]: readonly [string, string]) {
  return count === 1
    ? `${one.charAt(0).toUpperCase()}${one.slice(1)} deleted`
    : `${count} ${many} deleted`;
}

/** The toast after deleting one or more things for good: what went, and that it is gone. */
export function removedNotice(count: number, noun: readonly [string, string]): Notice {
  return {
    title: deletedTitle(count, noun),
    description: `${count === 1 ? 'It is' : 'They are'} gone from the CMS and the website.`,
  };
}

/**
 * The toast after deleting from a list that keeps a trash: off the website at once, with Undo
 * to bring it straight back. Undo, not a "Are you sure?" first: it catches the real mistakes
 * without asking every time.
 */
export function deletedNotice(
  count: number,
  noun: readonly [string, string],
  undo: () => unknown
): Notice {
  return {
    title: deletedTitle(count, noun),
    description: `${count === 1 ? 'It is' : 'They are'} off the website.`,
    action: { label: 'Undo', onClick: () => void undo() },
  };
}

/** The toast after Undo brings deleted things back. */
export function restoredNotice(count: number, [one, many]: readonly [string, string]): Notice {
  return {
    title:
      count === 1
        ? `${one.charAt(0).toUpperCase()}${one.slice(1)} restored`
        : `${count} ${many} restored`,
    description: `${count === 1 ? 'It is' : 'They are'} back as before.`,
  };
}

/** The toast after moving media to the trash, with Undo to bring it straight back. */
export function trashedNotice(count: number, undo: () => unknown): Notice {
  return {
    title: count === 1 ? 'Moved to the trash' : `${count} files moved to the trash`,
    description: `${count === 1 ? 'It is' : 'They are'} off the website, and deleted for good after ${MEDIA_TRASH_DAYS} days.`,
    action: { label: 'Undo', onClick: () => void undo() },
  };
}

/** The toast after a row's Publish or Unpublish. */
export function statusNotice(status: 'draft' | 'published'): Notice {
  return status === 'published'
    ? { title: 'Published', description: 'It shows on the website now.' }
    : { title: 'Unpublished', description: 'It is hidden from the website, and kept as a draft.' };
}

/** The toast after a row's Feature or Remove from featured. */
export function featuredNotice(featured: boolean): Notice {
  return featured
    ? { title: 'Featured', description: 'The website shows it ahead of the others.' }
    : { title: 'No longer featured', description: 'It takes its usual place on the website.' };
}
