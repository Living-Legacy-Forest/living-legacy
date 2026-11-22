import { describe, expect, it } from 'vitest';
import type { LocationItem } from '@/server/locations';
import {
  duplicateValues,
  initialLocationValues,
  isLocationDirty,
  nextSortOrder,
  pinOf,
  settledSlug,
  toLocationInput,
  withName,
} from './location-values';

const item: LocationItem = {
  id: 'l1',
  name: 'Wellington Dam',
  slug: 'wellington-dam',
  state: 'WA',
  region: 'Collie',
  stage: 'live',
  externalUrl: null,
  heroMediaId: 'm1',
  intro: 'A sentence.',
  about: null,
  address: '1 Dam Road, Wellington Mills WA 6236',
  latitude: -33.4,
  longitude: 115.9,
  mapUrl: null,
  hours: null,
  phone: null,
  email: null,
  hubspotFormId: null,
  seoTitle: null,
  seoDescription: null,
  ogMediaId: null,
  noindex: false,
  sortOrder: 3,
  status: 'draft',
};

describe('initialLocationValues', () => {
  it('starts a new location as an unpublished-stage listing that will be published', () => {
    expect(initialLocationValues(null, 4)).toMatchObject({
      name: '',
      slug: '',
      state: 'QLD',
      stage: 'coming_soon',
      sortOrder: '4',
      published: true,
      pin: null,
      heroMediaId: null,
    });
  });

  it('reads a saved location, its pin and whether it is published', () => {
    const values = initialLocationValues(item, 9);

    expect(values).toMatchObject({
      name: 'Wellington Dam',
      state: 'WA',
      sortOrder: '3',
      published: false,
      pin: { latitude: -33.4, longitude: 115.9 },
      externalUrl: '',
      hours: '',
    });
    expect(initialLocationValues({ ...item, status: 'published' }, 9).published).toBe(true);
    expect(initialLocationValues({ ...item, latitude: null }, 9).pin).toBeNull();
  });
});

describe('pinOf', () => {
  it('needs both coordinates', () => {
    expect(pinOf({ latitude: 1, longitude: 2 })).toEqual({ latitude: 1, longitude: 2 });
    expect(pinOf({ latitude: 1, longitude: null })).toBeNull();
  });
});

describe('nextSortOrder', () => {
  it('puts a new location after the last', () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([{ sortOrder: 2 }, { sortOrder: 9 }])).toBe(10);
  });
});

describe('slug', () => {
  const blank = initialLocationValues(null, 1);

  it('follows the name until someone edits it', () => {
    expect(withName(blank, 'Wellington Dam', false).slug).toBe('wellington-dam');
    expect(withName({ ...blank, slug: 'dam' }, 'Wellington Dam', true).slug).toBe('dam');
    expect(withName(blank, 'Wellington Dam', true).name).toBe('Wellington Dam');
  });

  it('settles to a clean slug, made from the name when left blank', () => {
    expect(settledSlug('', 'Mount Gambier')).toBe('mount-gambier');
    expect(settledSlug('My  Slug!', 'x')).toBe('my-slug');
  });
});

describe('toLocationInput', () => {
  const values = { ...initialLocationValues(item, 1), sortOrder: '7' };

  it('turns the form into what is saved', () => {
    const input = toLocationInput(values, 'l1');

    expect(input).toMatchObject({
      id: 'l1',
      name: 'Wellington Dam',
      sortOrder: 7,
      status: 'draft',
      pin: { latitude: -33.4, longitude: 115.9 },
    });
    expect('published' in input).toBe(false);
  });

  it('reads a blank order as 0, publishes on request and leaves the id off a new one', () => {
    const input = toLocationInput({ ...values, sortOrder: '', published: true });

    expect(input.sortOrder).toBe(0);
    expect(input.status).toBe('published');
    expect('id' in input).toBe(false);
  });
});

describe('isLocationDirty', () => {
  it('is clean until something changes', () => {
    const saved = initialLocationValues(item, 1);
    expect(isLocationDirty(saved, saved)).toBe(false);
    expect(isLocationDirty({ ...saved, name: 'Other' }, saved)).toBe(true);
  });
});

describe('duplicateValues', () => {
  const saved = { ...initialLocationValues(item, 1), published: true };

  it('makes a draft copy that goes at the end, with a name and slug of its own to settle', () => {
    const copy = duplicateValues(saved, 12);

    expect(copy).toMatchObject({
      name: 'Wellington Dam (copy)',
      slug: '',
      published: false,
      sortOrder: '12',
      address: item.address,
      pin: { latitude: -33.4, longitude: 115.9 },
      heroMediaId: 'm1',
    });
  });

  it('keeps the name inside its 120 character limit', () => {
    const long = { ...saved, name: 'x'.repeat(120) };

    const copy = duplicateValues(long, 1);

    expect(copy.name).toHaveLength(120);
    expect(copy.name.endsWith(' (copy)')).toBe(true);
  });
});
