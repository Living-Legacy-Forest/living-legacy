import { SlidersIcon } from '@/components/icons';
import { pillClass, ViewButtons } from '@/components/list/display-parts';
import type { ListView } from '@/components/list/view-switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type PostGrouping,
  type PostProperty,
  type PostsDisplay,
  defaultPostsDisplay,
  postGroupings,
  postProperties,
  toggleProperty,
} from '@/lib/posts-display';

type Option = { value: string; label: string };

function Field({
  label,
  id,
  value,
  options,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </label>
      <Select items={options} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id} size="sm" className="w-36 data-[size=sm]:h-7 md:text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The Display button: one place for how the list looks, in place of a Sort button, a view switch
 * and the details every row used to show. As Linear keeps them: view, grouping, ordering, then
 * the details as chips that switch on and off.
 */
export function PostDisplayMenu({
  display,
  onDisplayChange,
  view,
  onViewChange,
  sort,
  sorts,
  onSortChange,
}: {
  display: PostsDisplay;
  onDisplayChange: (next: PostsDisplay) => void;
  view: ListView;
  onViewChange: (next: ListView) => void;
  sort: string;
  sorts: readonly Option[];
  onSortChange: (next: string) => void;
}) {
  const grid = view === 'grid';
  const changed =
    display.grouping !== defaultPostsDisplay.grouping ||
    display.properties.join() !== defaultPostsDisplay.properties.join();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Display options"
            title="Display"
            className="text-muted-foreground hover:text-foreground relative shrink-0"
          />
        }
      >
        <SlidersIcon aria-hidden />
        {changed && (
          <span aria-hidden className="bg-brand absolute top-1 right-1 size-1.5 rounded-full" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3.5 p-3">
        <ViewButtons value={view} onChange={onViewChange} />

        <div className="flex flex-col gap-2.5">
          {/* Cards have no rows to group, so grouping waits for the list view. */}
          {!grid && (
            <Field
              id="posts-grouping"
              label="Grouping"
              value={display.grouping}
              options={postGroupings}
              onChange={(grouping) =>
                onDisplayChange({ ...display, grouping: grouping as PostGrouping })
              }
            />
          )}
          <Field
            id="posts-ordering"
            label="Ordering"
            value={sort}
            options={sorts}
            onChange={onSortChange}
          />
        </div>

        {!grid && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Display properties</span>
            <div className="flex flex-wrap gap-1">
              {postProperties.map((property) => {
                const on = display.properties.includes(property.value);
                return (
                  <button
                    key={property.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onDisplayChange(toggleProperty(display, property.value as PostProperty))
                    }
                    className={pillClass(on)}
                  >
                    {property.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {changed && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -mx-1 self-start text-xs"
            onClick={() => onDisplayChange(defaultPostsDisplay)}
          >
            Reset display
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
