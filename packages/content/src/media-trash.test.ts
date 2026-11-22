import { describe, expect, it } from 'vitest';
import { MEDIA_TRASH_DAYS, daysLeftInTrash, mediaPurgeCutoff } from './media-trash';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-22T17:00:00Z');

describe('mediaPurgeCutoff', () => {
  it('is the trash period before now', () => {
    expect(now.getTime() - mediaPurgeCutoff(now).getTime()).toBe(MEDIA_TRASH_DAYS * DAY);
  });
});

describe('daysLeftInTrash', () => {
  it('is the whole period for a file trashed just now', () => {
    expect(daysLeftInTrash(now, now)).toBe(MEDIA_TRASH_DAYS);
  });

  it('rounds a part day up, so the last day reads 1, not 0', () => {
    const trashed = new Date(now.getTime() - (MEDIA_TRASH_DAYS * DAY - 60_000));
    expect(daysLeftInTrash(trashed, now)).toBe(1);
  });

  it('takes a timestamp in milliseconds as well as a Date', () => {
    expect(daysLeftInTrash(now.getTime() - 10 * DAY, now)).toBe(MEDIA_TRASH_DAYS - 10);
  });

  it('never goes below 0 for a file past its time', () => {
    expect(daysLeftInTrash(now.getTime() - (MEDIA_TRASH_DAYS + 5) * DAY, now)).toBe(0);
  });

  it('agrees with the cutoff: a file trashed before it has 0 days left', () => {
    const cutoff = mediaPurgeCutoff(now);
    expect(daysLeftInTrash(cutoff.getTime() - 1, now)).toBe(0);
  });
});
