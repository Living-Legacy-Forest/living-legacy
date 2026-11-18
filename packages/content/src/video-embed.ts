// Videos in rich text. Only the providers below can be embedded, and only by id, so the stored
// document never holds an arbitrary iframe address and the website builds the player URL itself.

export const VIDEO_PROVIDERS = ['youtube', 'vimeo'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export interface VideoRef {
  provider: VideoProvider;
  id: string;
}

const ID_PATTERNS: Record<VideoProvider, RegExp> = {
  youtube: /^[\w-]{11}$/,
  vimeo: /^\d{6,12}$/,
};

export function isVideoRef(value: unknown): value is VideoRef {
  const ref = value as Partial<VideoRef> | null;
  return (
    !!ref &&
    typeof ref.provider === 'string' &&
    (VIDEO_PROVIDERS as readonly string[]).includes(ref.provider) &&
    typeof ref.id === 'string' &&
    ID_PATTERNS[ref.provider as VideoProvider].test(ref.id)
  );
}

const YOUTUBE_PATHS = /^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:[/?]|$)/;

/** A pasted watch, share or embed link (or a bare YouTube id) as a video, or null. */
export function parseVideoUrl(input: string): VideoRef | null {
  const text = input.trim();
  if (!text) return null;
  if (ID_PATTERNS.youtube.test(text)) return { provider: 'youtube', id: text };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./i, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return ID_PATTERNS.youtube.test(id) ? { provider: 'youtube', id } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? YOUTUBE_PATHS.exec(url.pathname)?.[1] ?? '';
    return ID_PATTERNS.youtube.test(id) ? { provider: 'youtube', id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123456789, vimeo.com/channels/x/123456789, player.vimeo.com/video/123456789
    const id =
      url.pathname
        .split('/')
        .filter(Boolean)
        .reverse()
        .find((s) => /^\d+$/.test(s)) ?? '';
    return ID_PATTERNS.vimeo.test(id) ? { provider: 'vimeo', id } : null;
  }
  return null;
}

/** The player address for an iframe. YouTube uses its no-cookie domain so a visit sets nothing. */
export function videoEmbedSrc({ provider, id }: VideoRef): string {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : `https://player.vimeo.com/video/${id}?dnt=1`;
}

/** Where the video lives, for a link under the player and for the editor's label. */
export function videoWatchUrl({ provider, id }: VideoRef): string {
  return provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${id}`
    : `https://vimeo.com/${id}`;
}

export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
};
