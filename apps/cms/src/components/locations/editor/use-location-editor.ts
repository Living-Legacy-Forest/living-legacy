import { useBlocker } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useMediaItem } from '@/components/media/image-field';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { type LocationItem, saveLocation } from '@/server/locations';
import {
  type LocationValues,
  initialLocationValues,
  isLocationDirty,
  settledSlug,
  toLocationInput,
  withName,
} from './location-values';

/**
 * State and actions for the location page: the form's values, saving, and the
 * warning before leaving with changes. A saved location stays as it is after a
 * save (scroll, cursor, panels); a new one moves to its own page.
 */
export function useLocationEditor({
  item,
  nextOrder,
  onSaved,
}: {
  item: LocationItem | null;
  nextOrder: number;
  onSaved: (id: string) => void;
}) {
  // What the server has: leaving with anything else loses it. A save replaces it.
  const [saved, setSaved] = useState(() => initialLocationValues(item, nextOrder));
  const [values, setValues] = useState<LocationValues>(saved);
  // A new location's slug follows its name until someone edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(item !== null);
  const { run, pending } = useAction();
  const heroUrl = useMediaItem(values.heroMediaId).item?.url;

  const patch = (next: Partial<LocationValues>) => setValues((v) => ({ ...v, ...next }));
  const setName = (name: string) => setValues((v) => withName(v, name, slugTouched));
  const setSlug = (slug: string) => {
    setSlugTouched(true);
    patch({ slug });
  };
  const settleSlug = () => setValues((v) => ({ ...v, slug: settledSlug(v.slug, v.name) }));

  const dirty = isLocationDirty(values, saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const skipBlockRef = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !skipBlockRef.current,
    enableBeforeUnload: () => dirtyRef.current && !skipBlockRef.current,
    withResolver: true,
  });
  /** For the navigation that follows a save or a delete: nothing is lost by it. */
  const skipBlock = () => {
    skipBlockRef.current = true;
  };

  async function save(overrides: Partial<LocationValues> = {}) {
    const sent = { ...values, ...overrides };
    const result = await run(() => saveLocation({ data: toLocationInput(sent, item?.id) }), {
      success: {
        title: item ? 'Location saved' : 'Location added',
        description: sent.published
          ? 'Its page and map pin show on the website.'
          : 'It is a draft, so the website does not show it.',
      },
      error: 'Could not save the location',
    });
    if (!result) return;
    if (item) {
      // The server may have made the slug unique ("town-2"); show what it stored. Anything
      // typed while saving is still a change.
      setValues((v) => ({ ...v, ...overrides, slug: result.slug }));
      setSaved({ ...sent, slug: result.slug });
    } else {
      skipBlock();
    }
    onSaved(result.id);
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (reportInvalid(e.currentTarget)) void save();
  };
  /** Saves and publishes in one go. */
  const publish = (form: HTMLFormElement) => {
    if (reportInvalid(form)) void save({ published: true });
  };

  return {
    values,
    patch,
    setName,
    setSlug,
    settleSlug,
    dirty,
    pending,
    submit,
    publish,
    skipBlock,
    blocker,
    heroUrl,
  };
}

export type LocationEditorState = ReturnType<typeof useLocationEditor>;
