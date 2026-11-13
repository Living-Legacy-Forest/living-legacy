import { useState } from 'react';
import { CalendarClockIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DayCalendar } from '@/components/ui/day-calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { displayTime, formatDateTime, fromZoned, parseTime, toZoned, zoneName } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A date and time in the site's configured time zone, picked from a calendar
 * with the time typed the way people write it ("9am", "5:30 pm"). Optional:
 * it can be cleared.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder,
  defaultTime = '09:00',
  minDate,
  zone: zoneOverride,
}: {
  id: string;
  /** A timestamp, or null when not set. */
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  /** "HH:MM" used when a day is picked before any time. */
  defaultTime?: string;
  /** Days before this timestamp's day cannot be picked. */
  minDate?: number | null;
  /** A zone of its own (an event's), instead of the site's. */
  zone?: string;
}) {
  const siteZone = useTimeZone();
  const zone = zoneOverride ?? siteZone;
  const wall = value === null ? null : toZoned(value, zone);
  const day = wall ? new Date(wall.year, wall.month, wall.day) : undefined;
  const time = wall ? `${pad(wall.hour)}:${pad(wall.minute)}` : defaultTime;
  const [timeText, setTimeText] = useState(displayTime(time));
  const [open, setOpen] = useState(false);
  const minWall = minDate === null || minDate === undefined ? null : toZoned(minDate, zone);

  const at = (nextDay: Date, nextTime: string) => {
    const [hour = 0, minute = 0] = nextTime.split(':').map(Number);
    return fromZoned(
      {
        year: nextDay.getFullYear(),
        month: nextDay.getMonth(),
        day: nextDay.getDate(),
        hour,
        minute,
      },
      zone
    );
  };

  return (
    // The clear button sits over the field's right edge; it can't be inside the trigger, as a
    // button can't hold another button.
    <div className="relative flex items-center">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setTimeText(displayTime(time));
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                'min-w-0 flex-1 justify-start font-normal',
                'touch:min-h-11',
                value === null ? 'text-muted-foreground' : 'pr-9'
              )}
            />
          }
        >
          <CalendarClockIcon aria-hidden data-icon="inline-start" />
          <span className="truncate">
            {value === null ? placeholder : formatDateTime(value, zone)}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <DayCalendar
            value={day}
            onChange={(next) => onChange(at(next, time))}
            minDate={minWall ? new Date(minWall.year, minWall.month, minWall.day) : undefined}
            className="px-3"
          />
          <div className="flex items-center gap-2 border-t p-3">
            <Label htmlFor={`${id}-time`} className="text-muted-foreground text-xs">
              Time
            </Label>
            <Input
              id={`${id}-time`}
              autoComplete="off"
              placeholder="9:00 am"
              value={timeText}
              aria-invalid={parseTime(timeText) === null}
              onChange={(e) => {
                setTimeText(e.target.value);
                const next = parseTime(e.target.value);
                if (next && day) onChange(at(day, next));
              }}
              onBlur={() => {
                const next = parseTime(timeText);
                if (next) setTimeText(displayTime(next));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              className="h-9 w-28"
            />
            <span className="text-muted-foreground text-xs">
              {zoneName(zone, value ?? undefined)}
            </span>
            <Button type="button" size="sm" className="ml-auto" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {value !== null && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear"
          className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => onChange(null)}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}
