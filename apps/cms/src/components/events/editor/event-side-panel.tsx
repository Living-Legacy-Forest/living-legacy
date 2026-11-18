import { EVENT_PHOTO_LIMIT, slugify, stateTimeZone } from '@ll/content';
import { Link } from '@tanstack/react-router';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormCell, FormSwitchCell } from '@/components/form-cells';
import { ImageGalleryField } from '@/components/media/image-gallery-field';
import { Input } from '@/components/ui/input';
import { WholeNumberInput } from '@/components/ui/whole-number-input';
import { NumberField } from '@/components/ui/number-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zoneName } from '@/lib/format';
import type { EventRow } from '@/server/events';
import type { EventEditorState } from './use-event-editor';

const NO_LOCATION = 'none';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 border-b pb-6 last:border-b-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Everything about an event that is not its story, starting with who has
 * booked: places and booking times, publishing, where, photos and its address.
 */
export function EventSidePanel({
  editor,
  event,
}: {
  editor: EventEditorState;
  event: EventRow | null;
}) {
  const { values, patch, zone, locations } = editor;
  const location = locations.find((l) => l.id === values.locationId);
  const locationItems = [
    { value: NO_LOCATION, label: 'No location' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="space-y-6 [--form-gap:1rem]">
      {event && (
        <Section title="Bookings">
          <p className="text-2xl font-semibold tabular-nums">
            {event.capacity !== null ? `${event.booked} / ${event.capacity}` : event.booked}
            <span className="text-muted-foreground ml-1.5 text-sm font-normal">booked</span>
          </p>
          <p className="text-muted-foreground text-sm tabular-nums">{event.checkedIn} checked in</p>
          <Link
            to="/events/$eventId"
            params={{ eventId: event.id }}
            search={{ view: 'guests' }}
            className="text-ui touch:min-h-11 inline-flex items-center font-medium underline-offset-4 hover:underline"
          >
            Guest list
          </Link>
        </Section>
      )}

      <Section title="Places and booking">
        <FormCell
          label="Capacity"
          htmlFor="ev-capacity"
          hint="Total people. Leave empty for no limit."
        >
          <WholeNumberInput
            id="ev-capacity"
            min={1}
            max={100_000}
            value={values.capacity}
            onValueChange={(typed) => patch({ capacity: typed === '' ? null : Number(typed) })}
            placeholder="No limit"
            className="w-28"
          />
        </FormCell>
        <FormCell
          label="Max per booking"
          htmlFor="ev-party"
          hint="For online bookings. Staff can add more."
        >
          <NumberField
            id="ev-party"
            min={1}
            max={50}
            value={values.maxPartySize}
            onValueChange={(maxPartySize) => patch({ maxPartySize })}
          />
        </FormCell>
        <FormCell
          label="Bookings open (optional)"
          htmlFor="ev-opens"
          hint="Online bookings open when it is published, unless set."
        >
          <DateTimePicker
            id="ev-opens"
            zone={zone}
            value={values.bookingsOpenAt}
            placeholder="When published"
            onChange={(bookingsOpenAt) => patch({ bookingsOpenAt })}
          />
        </FormCell>
        <FormCell
          label="Bookings close (optional)"
          htmlFor="ev-closes"
          hint="Online bookings close when it starts, unless set."
        >
          <DateTimePicker
            id="ev-closes"
            zone={zone}
            value={values.bookingsCloseAt}
            placeholder="When it starts"
            onChange={(bookingsCloseAt) => patch({ bookingsCloseAt })}
          />
        </FormCell>
      </Section>

      <Section title="Publishing">
        <FormSwitchCell
          id="ev-published"
          label="Published"
          description="Ready for the website once it shows events."
          checked={values.status === 'published'}
          // Publishing now replaces any time it was set to go live.
          onCheckedChange={(checked) =>
            patch({ status: checked ? 'published' : 'draft', publishAt: null })
          }
        />
        {values.status === 'draft' && (
          <FormCell
            label="Publish later"
            htmlFor="ev-publish-at"
            hint={
              values.publishAt
                ? `It goes live within five minutes of this time (${zoneName(zone, values.publishAt)}).`
                : 'Leave empty to publish it yourself.'
            }
          >
            <DateTimePicker
              id="ev-publish-at"
              zone={zone}
              value={values.publishAt}
              minDate={Date.now()}
              placeholder="Stay a draft"
              onChange={(publishAt) => patch({ publishAt })}
            />
          </FormCell>
        )}
      </Section>

      <Section title="Where">
        <FormCell label="Location" htmlFor="ev-location">
          <Select
            items={locationItems}
            value={values.locationId ?? NO_LOCATION}
            onValueChange={(value) => {
              const picked = locations.find((l) => l.id === value);
              // The venue follows the location while it is empty or still the
              // last location's address; one typed by hand is kept.
              const followsLocation = !values.venue || values.venue === location?.address;
              patch({
                locationId: picked ? picked.id : null,
                ...(followsLocation ? { venue: picked?.address ?? '' } : {}),
              });
              if (picked && !editor.zoneChosen) editor.rezone(stateTimeZone(picked.state));
            }}
          >
            <SelectTrigger id="ev-location" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormCell>
        <FormCell label="Venue" htmlFor="ev-venue">
          <Input
            id="ev-venue"
            maxLength={300}
            value={values.venue}
            onChange={(e) => patch({ venue: e.target.value })}
            placeholder={location?.address || 'Where to go'}
          />
        </FormCell>
      </Section>

      <Section title="Gallery">
        <ImageGalleryField
          id="ev-photos"
          label="Photos"
          description={`Up to ${EVENT_PHOTO_LIMIT - 1}, after the cover.`}
          max={EVENT_PHOTO_LIMIT - 1}
          mediaIds={values.galleryMediaIds}
          onChange={(galleryMediaIds) => patch({ galleryMediaIds })}
        />
      </Section>

      <Section title="On the website">
        <FormCell
          label="Web address"
          htmlFor="ev-slug"
          hint={
            event?.seriesId || editor.repeat.repeat !== 'none'
              ? 'One address for all its dates, used for its page once the website shows events.'
              : 'Used for its page once the website shows events.'
          }
        >
          <Input
            id="ev-slug"
            maxLength={120}
            value={values.slug}
            onChange={(e) => patch({ slug: e.target.value })}
            placeholder={slugify(values.title) || 'event-name'}
            className="font-mono"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </FormCell>
      </Section>
    </div>
  );
}
