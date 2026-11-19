import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { layout } from './email';

beforeAll(() => {
  (env as unknown as Record<string, string>).BETTER_AUTH_URL = 'https://cms.example.com/some/path';
});

const base = {
  preheader: 'Preview text',
  heading: 'Sign in to the CMS',
  intro: ['Use the button below.'],
  button: { label: 'Sign in', url: 'https://cms.example.com/verify?token=a&next=b' },
};

describe('email layout', () => {
  it('puts the heading above the card and the button inside it', () => {
    const html = layout(base);
    const heading = html.indexOf('<h1');
    const card = html.indexOf('border-radius:12px');
    const button = html.indexOf('>Sign in</a>');
    expect(heading).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(heading);
    expect(button).toBeGreaterThan(card);
  });

  it('serves the logo from the CMS origin, not a path under it', () => {
    expect(layout(base)).toContain('src="https://cms.example.com/email/logo-mark.png"');
  });

  it('escapes the heading, the preview text and the link, but not the intro HTML', () => {
    const html = layout({
      ...base,
      preheader: 'a <b> & c',
      heading: 'Hello <script>',
      intro: ['<strong>bold</strong>'],
    });
    expect(html).toContain('Hello &lt;script&gt;');
    expect(html).toContain('a &lt;b&gt; &amp; c');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('<script>');
    // The address is escaped in both the button and the fallback line.
    expect(html.split('token=a&amp;next=b').length - 1).toBe(3);
  });

  it('puts the note in a strip along the foot of the card, after the button', () => {
    const html = layout({ ...base, note: 'If this was not you, ignore it.' });
    const strip = html.indexOf('border-top:1px solid');
    expect(strip).toBeGreaterThan(html.indexOf('>Sign in</a>'));
    expect(html.indexOf('If this was not you, ignore it.')).toBeGreaterThan(strip);
  });

  it('has no strip without a note', () => {
    expect(layout(base)).not.toContain('border-top:1px solid');
  });
});
