import { ActivityHeatmap } from '@/components/arc/activity-heatmap/activity-heatmap';
import { useWeekStart } from '@/lib/use-week-start';
import type { ActivityDay } from '@/server/activity-log';

const UNIT = { one: 'change', other: 'changes' };

/**
 * A year of changes as a calendar: a square a day, darker the busier it was. Weeks start on
 * the day the site chose (Settings, General). With `onSelectDate`, clicking a day picks it.
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
  const weekStartsOn = useWeekStart();
  return (
    <ActivityHeatmap
      days={days}
      label={label}
      period={period}
      unit={UNIT}
      weekStartsOn={weekStartsOn}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
    />
  );
}
