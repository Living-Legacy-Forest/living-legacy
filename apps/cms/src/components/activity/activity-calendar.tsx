import { ActivityHeatmap } from '@/components/arc/activity-heatmap/activity-heatmap';
import type { ActivityDay } from '@/server/activity-log';

const UNIT = { one: 'change', other: 'changes' };

/**
 * A year of changes as a calendar: a square a day, darker the busier it was. Weeks start on
 * Monday, as they do in Australia. With `onSelectDate`, clicking a day picks it.
 */
export function ActivityCalendar({
  days,
  label,
  period = 'the past year',
  selectedDate = null,
  onSelectDate,
}: {
  days: ActivityDay[];
  label: string;
  period?: string;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}) {
  return (
    <ActivityHeatmap
      days={days}
      label={label}
      period={period}
      unit={UNIT}
      weekStartsOn={1}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
    />
  );
}
