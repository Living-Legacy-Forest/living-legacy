// Press and broadcast coverage, shown on the website's "In the media" page.
// Shared by the CMS (to validate and preview) and the site (to render).

export const mediaCoverageKinds = ['article', 'video'] as const;
export type MediaCoverageKind = (typeof mediaCoverageKinds)[number];

export const mediaCoverageKindLabels: Record<MediaCoverageKind, string> = {
  article: 'News article',
  video: 'Video',
};

/**
 * The video id in a YouTube link (watch, youtu.be, shorts, embed or live), or
 * null when the URL is not a YouTube video. The site embeds these in place;
 * any other video link opens in a new tab.
 */
export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = parsed.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = parsed.pathname.split('/');
    if (first === 'watch') id = parsed.searchParams.get('v');
    else if (first === 'shorts' || first === 'embed' || first === 'live') id = second ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
