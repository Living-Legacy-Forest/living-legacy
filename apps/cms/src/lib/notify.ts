import { toast } from 'sonner';
import { readableError } from './errors';

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
  error: (title: string, reason: unknown, options?: Options) =>
    toast.error(title, {
      description: typeof reason === 'string' ? reason : readableError(reason),
      ...options,
    }),
};

/** The toast after deleting one or more things: what went, and that it is gone. */
export function removedNotice(count: number, [one, many]: readonly [string, string]): Notice {
  return {
    title:
      count === 1
        ? `${one.charAt(0).toUpperCase()}${one.slice(1)} removed`
        : `${count} ${many} removed`,
    description: `${count === 1 ? 'It is' : 'They are'} gone from the CMS and the website.`,
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
