import { describe, expect, it } from 'vitest';
import {
  type CalendarDate,
  MAX_OCCURRENCES,
  occurrenceDates,
  occurrenceTimes,
  parseTime,
  repeatLabel,
} from './recurrence';

const MELBOURNE = 'Australia/Melbourne';
// Months are 0-based, as in Date: 10 is November.
const d = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });
const show = (dates: CalendarDate[]) => dates.map((x) => `${x.year}-${x.month + 1}-${x.day}`);

describe('occurrenceDates', () => {
  it('is the one date when it does not repeat', () => {
    expect(show(occurrenceDates(d(2026, 10, 14), 'none', { count: 5 }))).toEqual(['2026-11-14']);
  });

  it('repeats weekly a number of times, across a month end', () => {
    expect(show(occurrenceDates(d(2026, 10, 14), 'weekly', { count: 4 }))).toEqual([
      '2026-11-14',
      '2026-11-21',
      '2026-11-28',
      '2026-12-5',
    ]);
  });

  it('repeats every two weeks until a date, including that date', () => {
    expect(
      show(occurrenceDates(d(2026, 10, 14), 'fortnightly', { until: d(2026, 11, 12) }))
    ).toEqual(['2026-11-14', '2026-11-28', '2026-12-12']);
  });

  it('repeats monthly on the same weekday, such as the 2nd Saturday, into a new year', () => {
    expect(show(occurrenceDates(d(2026, 10, 14), 'monthly_weekday', { count: 3 }))).toEqual([
      '2026-11-14',
      '2026-12-12',
      '2027-1-9',
    ]);
  });

  it('treats a 5th weekday as the last one of each month', () => {
    // 31 Oct 2026 is the 5th Saturday; November's last Saturday is the 28th.
    expect(show(occurrenceDates(d(2026, 9, 31), 'monthly_weekday', { count: 2 }))).toEqual([
      '2026-10-31',
      '2026-11-28',
    ]);
  });

  it('skips months without the date when repeating on the same date', () => {
    expect(show(occurrenceDates(d(2027, 0, 31), 'monthly_date', { count: 3 }))).toEqual([
      '2027-1-31',
      '2027-3-31',
      '2027-5-31',
    ]);
  });

  it(`never makes more than ${MAX_OCCURRENCES} dates`, () => {
    expect(occurrenceDates(d(2026, 10, 14), 'weekly', { count: 500 })).toHaveLength(
      MAX_OCCURRENCES
    );
    expect(occurrenceDates(d(2026, 10, 14), 'weekly', {})).toHaveLength(MAX_OCCURRENCES);
  });
});

describe('occurrenceTimes', () => {
  it('keeps the clock time across a daylight saving change', () => {
    const [summer, winter] = occurrenceTimes([d(2026, 10, 14), d(2027, 4, 8)], {
      startTime: '10:00',
      endTime: '12:00',
      spanDays: 0,
      zone: MELBOURNE,
    });
    // AEDT (+11) in November, AEST (+10) in May: still 10:00 to 12:00 local.
    expect(summer).toEqual({
      startsAt: Date.UTC(2026, 10, 13, 23, 0),
      endsAt: Date.UTC(2026, 10, 14, 1, 0),
    });
    expect(winter).toEqual({
      startsAt: Date.UTC(2027, 4, 8, 0, 0),
      endsAt: Date.UTC(2027, 4, 8, 2, 0),
    });
  });

  it('ends on a later day for a multi-day event', () => {
    const [first] = occurrenceTimes([d(2026, 10, 14)], {
      startTime: '09:00',
      endTime: '16:00',
      spanDays: 1,
      zone: MELBOURNE,
    });
    expect(first!.endsAt - first!.startsAt).toBe(31 * 60 * 60 * 1000);
  });
});

describe('parseTime', () => {
  it('reads 24-hour and am/pm times', () => {
    expect(parseTime('10:00')).toEqual({ hour: 10, minute: 0 });
    expect(parseTime('9:30 am')).toEqual({ hour: 9, minute: 30 });
    expect(parseTime('2pm')).toEqual({ hour: 14, minute: 0 });
    expect(parseTime('12:15 am')).toEqual({ hour: 0, minute: 15 });
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('soon')).toBeNull();
  });
});

describe('repeatLabel', () => {
  it('names the pattern from the first date', () => {
    expect(repeatLabel('monthly_weekday', d(2026, 10, 14))).toBe('Monthly on the 2nd Saturday');
    expect(repeatLabel('monthly_weekday', d(2026, 9, 31))).toBe('Monthly on the last Saturday');
    expect(repeatLabel('monthly_date', d(2026, 10, 14))).toBe('Monthly on the 14th');
    expect(repeatLabel('weekly', d(2026, 10, 14))).toBe('Every Saturday');
    expect(repeatLabel('fortnightly', d(2026, 10, 14))).toBe('Every 2 weeks on Saturday');
  });
});
