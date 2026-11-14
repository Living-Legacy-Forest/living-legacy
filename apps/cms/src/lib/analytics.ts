// The Analytics pages' shared rules: the periods they offer, how a visit's channel is worked
// out, and how PostHog's rows add up into the lists the pages show. Plain functions, shared by
// the server (which shapes PostHog's rows) and the pages.

import { z } from 'zod';
import { type TrafficSource, sourceLabels, trafficSource } from './visitors';

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = 30;

export const isAnalyticsRange = (days: unknown): days is AnalyticsRange =>
  (ANALYTICS_RANGES as readonly unknown[]).includes(days);

/** The search every Analytics page takes: the period, left out of the address when 30 days. */
export const analyticsSearch = z.object({
  days: z.number().refine(isAnalyticsRange).optional().catch(undefined),
});

/** The server functions' input: a period, 30 days when anything else is asked for. */
export const rangeInput = z.object({
  days: z
    .number()
    .catch(DEFAULT_RANGE)
    .transform((d): AnalyticsRange => (isAnalyticsRange(d) ? d : DEFAULT_RANGE)),
});

/** Where a visit came from: the referrer's kind, or the campaign's when its link says. */
export type Channel = TrafficSource | 'paid' | 'email';

export const channelLabels: Record<Channel, string> = {
  ...sourceLabels,
  paid: 'Paid ads',
  email: 'Email',
};

const PAID = /^(cpc|ppc|paid|paidsearch|paid[-_ ]?social|display|cpm|banner)$/;
const EMAIL = /^(e-?mail|newsletter)$/;

/**
 * The channel of a visit, from its first page: a campaign link's `utm_medium` says paid or
 * email outright; otherwise the site it came from decides.
 */
export function channelOf(referringDomain: string | null | undefined, medium?: string | null) {
  const m = (medium ?? '').trim().toLowerCase();
  if (PAID.test(m)) return { ...trafficSource(referringDomain), channel: 'paid' as Channel };
  if (EMAIL.test(m)) return { ...trafficSource(referringDomain), channel: 'email' as Channel };
  const source = trafficSource(referringDomain);
  return { ...source, channel: source.source as Channel };
}

/** "Planting day | Living Legacy" reads as "Planting day": the site's name is on every page. */
export const pageName = (page: { path: string; title?: string | null }) =>
  (page.title ?? '').replace(/\s+[|–—]\s+[^|–—]*$/, '').trim() || page.path;

export type Ranked = { key: string; label: string; value: number };

/**
 * Adds up `value` for each key and sorts biggest first; ties keep their label order. A row
 * with no key is dropped, so "unknown" never crowds out real answers.
 */
export function rollUp<Row>(
  rows: Row[],
  key: (row: Row) => string | null | undefined,
  value: (row: Row) => number,
  label: (key: string, row: Row) => string = (k) => k
): Ranked[] {
  const totals = new Map<string, Ranked>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const entry = totals.get(k) ?? { key: k, label: label(k, row), value: 0 };
    entry.value += value(row);
    totals.set(k, entry);
  }
  return [...totals.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** A share of a whole as a percentage, or null when there is no whole. */
export const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/** "4m 05s", "38s": how long a visit or a page held someone. */
export function formatSeconds(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return '–';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** "42%", or a dash when there is nothing to measure. */
export const formatPercent = (value: number | null) =>
  value === null ? '–' : `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;

/** The website's forms, as `form_type` names them, in the CMS's words. */
export const formLabels: Record<string, string> = {
  contact: 'Contact',
  interest: 'Register interest',
  tour: 'Book a tour',
  brochure: 'Brochure request',
  partner: 'Partner enquiry',
};
