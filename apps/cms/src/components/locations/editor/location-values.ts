import { type AustralianState, type LocationStage, type RichTextDoc, slugify } from '@ll/content';
import type { LocationInput, LocationItem } from '@/server/locations';
import type { Pin } from '../location-map';

// The rules behind the location page's form, kept apart from React so they can be tested.

export type LocationValues = {
  name: string;
  slug: string;
  state: AustralianState;
  region: string;
  stage: LocationStage;
  externalUrl: string;
  heroMediaId: string | null;
  intro: string;
  about: RichTextDoc | null;
  address: string;
  pin: Pin | null;
  mapUrl: string;
  hours: string;
  phone: string;
  email: string;
  hubspotFormId: string;
  seoTitle: string;
  seoDescription: string;
  ogMediaId: string | null;
  noindex: boolean;
  /** Typed in a number box, so kept as text until it is saved. */
  sortOrder: string;
  published: boolean;
};

export const pinOf = (l: { latitude: number | null; longitude: number | null }): Pin | null =>
  l.latitude !== null && l.longitude !== null
    ? { latitude: l.latitude, longitude: l.longitude }
    : null;

export function initialLocationValues(
  item: LocationItem | null,
  nextOrder: number
): LocationValues {
  return {
    name: item?.name ?? '',
    slug: item?.slug ?? '',
    state: item?.state ?? 'QLD',
    region: item?.region ?? '',
    stage: item?.stage ?? 'coming_soon',
    externalUrl: item?.externalUrl ?? '',
    heroMediaId: item?.heroMediaId ?? null,
    intro: item?.intro ?? '',
    about: item?.about ?? null,
    address: item?.address ?? '',
    pin: item ? pinOf(item) : null,
    mapUrl: item?.mapUrl ?? '',
    hours: item?.hours ?? '',
    phone: item?.phone ?? '',
    email: item?.email ?? '',
    hubspotFormId: item?.hubspotFormId ?? '',
    seoTitle: item?.seoTitle ?? '',
    seoDescription: item?.seoDescription ?? '',
    ogMediaId: item?.ogMediaId ?? null,
    noindex: item?.noindex ?? false,
    sortOrder: String(item?.sortOrder ?? nextOrder),
    published: item ? item.status === 'published' : true,
  };
}

/** A new location goes after the last one. */
export const nextSortOrder = (items: { sortOrder: number }[]) =>
  Math.max(0, ...items.map((l) => l.sortOrder)) + 1;

/** A new location's slug follows its name until someone edits the slug itself. */
export function withName(values: LocationValues, name: string, slugTouched: boolean) {
  return { ...values, name, ...(slugTouched ? {} : { slug: slugify(name) }) };
}

/** What a slug becomes when its box is left: cleaned up, or made from the name if blank. */
export const settledSlug = (slug: string, name: string) => slugify(slug || name);

export function toLocationInput(values: LocationValues, id?: string): LocationInput {
  const { published, sortOrder, ...rest } = values;
  return {
    ...(id ? { id } : {}),
    ...rest,
    sortOrder: Number(sortOrder) || 0,
    status: published ? 'published' : 'draft',
  };
}

/** A copy to start from: a draft at the end of the order, its slug made from its new name. */
export function duplicateValues(values: LocationValues, nextOrder: number): LocationValues {
  const suffix = ' (copy)';
  return {
    ...values,
    name: values.name.slice(0, 120 - suffix.length) + suffix,
    slug: '',
    published: false,
    sortOrder: String(nextOrder),
  };
}

/** Whether leaving the page would lose something. */
export const isLocationDirty = (values: LocationValues, saved: LocationValues) =>
  JSON.stringify(values) !== JSON.stringify(saved);
