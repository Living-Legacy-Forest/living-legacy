import { useEffect, useState } from 'react';
import { type PostPreviewData, getPostPreview } from '@/server/posts';

// Previews are cached per post so moving through the list feels instant.
const cache = new Map<string, Promise<PostPreviewData>>();

export function loadPostPreview(id: string) {
  let pending = cache.get(id);
  if (!pending) {
    pending = getPostPreview({ data: { id } });
    cache.set(id, pending);
    pending.catch(() => cache.delete(id));
  }
  return pending;
}

/** Drop cached previews after a change (save, trash, restore). */
export function clearPostPreviews() {
  cache.clear();
}

export function usePostPreview(id: string | null) {
  const [state, setState] = useState<{
    id: string | null;
    post: PostPreviewData | null;
    error: string | null;
  }>({ id: null, post: null, error: null });

  useEffect(() => {
    if (!id) return;
    let active = true;
    loadPostPreview(id).then(
      (post) => active && setState({ id, post, error: null }),
      (error: unknown) =>
        active &&
        setState({
          id,
          post: null,
          error: error instanceof Error ? error.message : 'Could not load this post.',
        })
    );
    return () => {
      active = false;
    };
  }, [id]);

  const current = state.id === id;
  return {
    post: current ? state.post : null,
    error: current ? state.error : null,
    loading: Boolean(id) && !current,
  };
}
