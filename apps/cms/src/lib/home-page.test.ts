import { describe, expect, it } from 'vitest';
import { homePagePath } from './home-page';

describe('homePagePath', () => {
  it('opens the page the site chose', () => {
    expect(homePagePath('calendar', { role: 'admin' })).toBe('/calendar');
    expect(homePagePath('events', { role: 'admin' })).toBe('/events/overview');
  });

  it('falls back to the dashboard for someone who cannot open it', () => {
    expect(homePagePath('events', { role: 'viewer' })).toBe('/');
    expect(homePagePath('analytics', { role: 'viewer' })).toBe('/');
  });
});
