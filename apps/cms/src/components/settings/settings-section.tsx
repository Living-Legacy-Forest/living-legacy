import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// The grouped sections and rows of the Settings and Profile pages: from md, a title and
// description on the left with the settings beside them; iOS Settings' inset groups on phones.

export function SettingsSection({
  id,
  title,
  description,
  framed = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /**
   * Draws a border round the group, for lists and tables (rules, pages, devices) that read as
   * rows of one thing. Plain settings rows sit unframed.
   */
  framed?: boolean;
  children: ReactNode;
}) {
  return (
    // From md, the title and what the section is for sit in a column on the left and the
    // settings on the right, with a rule between sections. Phones keep iOS Settings' groups.
    <section
      id={id}
      className="scroll-mt-32 max-md:space-y-1.5 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-x-10 md:border-t md:pt-8 md:first:border-t-0 md:first:pt-0"
    >
      {/* Phones: iOS Settings' small grey heading over an inset group. */}
      <div className="max-md:px-4">
        <h2 className="text-sm font-semibold max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-1 text-[0.8125rem] text-pretty max-md:mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div
        data-slot="settings-group"
        data-framed={framed || undefined}
        className={cn(
          'min-w-0 max-md:divide-y max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell)',
          framed ? 'md:divide-y md:overflow-hidden md:rounded-lg md:border' : 'md:space-y-6'
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  id,
  title,
  description,
  suffix,
  stacked = false,
  below = false,
  children,
}: {
  /** The field's id, so the title labels it (and error toasts can name it). */
  id: string;
  title: string;
  description?: ReactNode;
  suffix?: ReactNode;
  stacked?: boolean;
  /** Phones: the control takes its own line under the title, for one too wide to sit beside it. */
  below?: boolean;
  children: ReactNode;
}) {
  if (stacked) {
    return (
      <div
        data-slot="settings-row"
        data-stacked=""
        className="space-y-1.5 max-md:px-4 max-md:py-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{title}</Label>
          {suffix}
        </div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
        {children}
      </div>
    );
  }

  return (
    // Phones: a form cell's layout, the label left and the value right with the
    // description under the row (styles.css, settings-row).
    <div
      data-slot="settings-row"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 max-md:grid max-md:grid-cols-[fit-content(50%)_minmax(0,1fr)] max-md:gap-y-0 max-md:px-4 max-md:py-0"
    >
      <div className="min-w-0 flex-1 space-y-0.5 max-md:contents">
        <Label htmlFor={id}>{title}</Label>
        {description && (
          <p className="text-muted-foreground text-xs max-md:col-span-2 max-md:row-start-2">
            {description}
          </p>
        )}
      </div>
      <div
        data-slot="settings-control"
        className={cn(
          'w-full shrink-0 max-md:flex max-md:min-w-0 sm:w-auto',
          below
            ? 'max-md:col-span-2 max-md:row-start-2 max-md:pb-3'
            : 'max-md:col-start-2 max-md:row-start-1 max-md:justify-end'
        )}
      >
        {children}
      </div>
    </div>
  );
}
