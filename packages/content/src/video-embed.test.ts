import { describe, expect, it } from 'vitest';
import { isVideoRef, parseVideoUrl, videoEmbedSrc } from './video-embed';

const youtube = { provider: 'youtube', id: 'dQw4w9WgXcQ' } as const;

describe('parseVideoUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
  ])('reads %s as YouTube', (input) => {
    expect(parseVideoUrl(input)).toEqual(youtube);
  });

  it.each([
    'https://vimeo.com/76979871',
    'https://vimeo.com/channels/staffpicks/76979871',
    'https://player.vimeo.com/video/76979871?h=abc',
  ])('reads %s as Vimeo', (input) => {
    expect(parseVideoUrl(input)).toEqual({ provider: 'vimeo', id: '76979871' });
  });

  it.each([
    '',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://vimeo.com/about',
    'javascript:alert(1)',
  ])('rejects %j', (input) => {
    expect(parseVideoUrl(input)).toBeNull();
  });
});

describe('videoEmbedSrc', () => {
  it('builds the player address from the id alone', () => {
    expect(videoEmbedSrc(youtube)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbedSrc({ provider: 'vimeo', id: '76979871' })).toBe(
      'https://player.vimeo.com/video/76979871?dnt=1'
    );
  });
});

describe('isVideoRef', () => {
  it('needs a known provider and an id of the right shape', () => {
    expect(isVideoRef(youtube)).toBe(true);
    expect(isVideoRef({ provider: 'youtube', id: 'x" onload="y' })).toBe(false);
    expect(isVideoRef({ provider: 'tiktok', id: '1234567' })).toBe(false);
    expect(isVideoRef(null)).toBe(false);
  });
});
