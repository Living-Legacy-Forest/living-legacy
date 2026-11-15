import { timeZones } from '@ll/content';
import { FormBlock, FormCell, FormSection } from '@/components/form-cells';
import { ImageField } from '@/components/media/image-field';
import { RichTextField } from '@/components/rich-text-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { zoneName } from '@/lib/format';
import type { EventRow } from '@/server/events';
import { EventDatesField } from '../event-dates-field';
import { RepeatField } from '../repeat-field';
import type { EventEditorState } from './use-event-editor';

/** "Perth (AWST)": the zone's city and its abbreviation now. */
const zoneItems = timeZones.map((value) => ({
  value,
  label: `${value.split('/')[1]?.replace('_', ' ')} (${zoneName(value)})`,
}));

/**
 * The story of the event, the way a post's body is the centre of its page: the
 * cover, title, summary and description, then when it runs. A new event also
 * sets how it repeats and any extra times here.
 */
export function EventMain({ editor, event }: { editor: EventEditorState; event: EventRow | null }) {
  const { values, patch, zone } = editor;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 [--form-gap:1.25rem] max-md:space-y-7">
      <ImageField
        id="ev-cover"
        label="Cover photo"
        mediaId={values.heroMediaId}
        onChange={(heroMediaId) => patch({ heroMediaId })}
      />

      <FormSection>
        <FormCell label="Title" htmlFor="ev-title">
          <Input
            id="ev-title"
            required
            maxLength={120}
            value={values.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Event name"
            enterKeyHint="done"
            className="h-11 text-lg font-semibold"
          />
        </FormCell>
        <FormCell label="Summary" htmlFor="ev-summary" hint="Shown in event lists.">
          <Textarea
            id="ev-summary"
            rows={2}
            maxLength={200}
            value={values.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="A sentence about the event"
          />
        </FormCell>
      </FormSection>

      <FormBlock label="Description" labelId="ev-description-label" htmlFor="ev-description">
        <RichTextField
          id="ev-description"
          labelId="ev-description-label"
          value={values.description}
          onChange={(description) => patch({ description })}
          placeholder="What happens, what to bring, parking"
        />
      </FormBlock>

      <section
        aria-label="Sessions"
        className="space-y-5 border-t pt-8 max-md:border-0 max-md:pt-0"
      >
        <h2 className="text-base font-semibold max-md:px-4 max-md:text-[1.0625rem]">Sessions</h2>
        <FormSection>
          <FormCell
            label="Time zone"
            htmlFor="ev-zone"
            hint="Set from the location's state. Dates and times below are in this zone."
          >
            <Select
              items={zoneItems}
              value={values.timeZone}
              onValueChange={(next) => {
                if (!next) return;
                editor.setZoneChosen(true);
                editor.rezone(next);
              }}
            >
              <SelectTrigger id="ev-zone" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zoneItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormCell>
        </FormSection>

        <FormSection>
          <EventDatesField
            // A new zone re-reads the times shown.
            key={values.timeZone}
            id="ev-date"
            zone={zone}
            value={{ startsAt: values.startsAt, endsAt: values.endsAt }}
            onChange={(next) => patch(next)}
            sessions={event ? undefined : editor.sessions}
            onSessionsChange={event ? undefined : editor.setSessions}
          />
        </FormSection>

        {event?.seriesId ? (
          <p className="text-muted-foreground text-xs max-md:px-4 max-md:text-[0.8125rem]">
            One date of a repeating event. Saving asks whether to change the upcoming dates too.
          </p>
        ) : (
          !event && (
            <FormSection>
              <RepeatField
                zone={zone}
                first={editor.times}
                value={editor.repeat}
                onChange={editor.setRepeat}
              />
            </FormSection>
          )
        )}
      </section>
    </div>
  );
}
