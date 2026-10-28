import { CalendarClockIcon, ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type WallTime, formatDateTime, fromZoned, toZoned, zoneName } from '@/lib/format';
import { cn } from '@/lib/utils';

const MIN_LEAD_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

// The calendar works in plain calendar days; times are Melbourne wall-clock
// times, converted to an instant only when scheduling.
const dayOf = (wall: WallTime) => new Date(wall.year, wall.month, wall.day);
const timeOf = (wall: WallTime) => `${pad(wall.hour)}:${pad(wall.minute)}`;

function instant(day: Date, time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return fromZoned({
    year: day.getFullYear(),
    month: day.getMonth(),
    day: day.getDate(),
    hour,
    minute,
  });
}

/** Quick picks, in Melbourne time. */
function presets(now = Date.now()) {
  const today = toZoned(now);
  const at9 = (offsetDays: number) => {
    const day = new Date(today.year, today.month, today.day + offsetDays);
    return toZoned(instant(day, '09:00'));
  };
  const weekday = new Date(today.year, today.month, today.day).getDay();
  const soon = toZoned(now + 60 * 60_000);
  soon.minute = Math.min(55, Math.ceil(soon.minute / 5) * 5);
  return [
    { label: 'In an hour', at: soon },
    { label: 'Tomorrow, 9 am', at: at9(1) },
    { label: 'Monday, 9 am', at: at9((8 - weekday) % 7 || 7) },
  ];
}

/**
 * Chevron next to the Publish button that opens a date and time picker.
 * Times are the browser's local time, labelled with its time zone.
 */
export function SchedulePopover({
  scheduledAt,
  disabled,
  onSchedule,
  onUnschedule,
}: {
  scheduledAt: number | null;
  disabled?: boolean;
  onSchedule: (at: number) => Promise<boolean>;
  onUnschedule: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>();
  const [time, setTime] = useState('09:00');
  const [pending, setPending] = useState(false);

  const reset = () => {
    const base = scheduledAt ? toZoned(scheduledAt) : presets()[1]!.at;
    setDay(dayOf(base));
    setTime(timeOf(base));
  };

  const target = day ? instant(day, time) : null;
  const tooSoon = target === null || target < Date.now() + MIN_LEAD_MS;

  async function submit() {
    if (target === null || tooSoon) return;
    setPending(true);
    const ok = await onSchedule(target);
    setPending(false);
    if (ok) setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            size="sm"
            disabled={disabled}
            aria-label={scheduledAt ? 'Change schedule' : 'Schedule for later'}
            className="border-primary-foreground/20 rounded-l-none border-l px-1.5"
          />
        }
      >
        <ChevronDownIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2.5 text-[13px] font-medium">
          <CalendarClockIcon aria-hidden className="text-muted-foreground size-4" />
          {scheduledAt ? 'Reschedule' : 'Schedule for later'}
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {presets().map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="xs"
              onClick={() => {
                setDay(dayOf(preset.at));
                setTime(timeOf(preset.at));
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="single"
          selected={day}
          onSelect={setDay}
          disabled={{ before: dayOf(toZoned(Date.now())) }}
          className="px-3"
        />
        <div className="space-y-3 border-t p-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="schedule-time" className="text-muted-foreground text-xs">
              Time
            </Label>
            <Input
              id="schedule-time"
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-8 w-32"
            />
            <span className="text-muted-foreground text-xs">{zoneName()}</span>
          </div>
          <p className={cn('text-xs', tooSoon ? 'text-destructive' : 'text-muted-foreground')}>
            {!target
              ? 'Pick a day.'
              : tooSoon
                ? 'Pick a time at least a minute from now.'
                : `Publishes ${formatDateTime(target)} ${zoneName(target)}.`}
          </p>
          <div className="flex justify-end gap-2">
            {scheduledAt && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  await onUnschedule();
                  setPending(false);
                  setOpen(false);
                }}
              >
                Unschedule
              </Button>
            )}
            <Button size="sm" disabled={pending || tooSoon} onClick={submit}>
              {scheduledAt ? 'Reschedule' : 'Schedule'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
