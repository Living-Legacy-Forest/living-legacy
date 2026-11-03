import { describe, expect, it } from 'vitest';
import { youtubeId } from './media-coverage';

describe('youtubeId', () => {
  it('reads the id from the usual link shapes', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=_fxvSz2XfU8')).toBe('_fxvSz2XfU8');
    expect(youtubeId('https://youtu.be/TZTP7yN7kfE?t=30')).toBe('TZTP7yN7kfE');
    expect(youtubeId('https://m.youtube.com/watch?v=IpvLFePdRlQ&list=x')).toBe('IpvLFePdRlQ');
    expect(youtubeId('https://www.youtube.com/shorts/b_yZqCOx3EU')).toBe('b_yZqCOx3EU');
    expect(youtubeId('https://www.youtube-nocookie.com/embed/b_yZqCOx3EU')).toBe('b_yZqCOx3EU');
  });

  it('is null for anything else', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('https://www.youtube.com/@channel')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
  });
});
