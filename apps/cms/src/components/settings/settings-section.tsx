import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

// The grouped sections and rows of the Settings and Profile pages: a heading
// over a bordered group of rows on desktop, iOS Settings' inset groups on phones.

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3 max-md:space-y-1.5">
      {/* Phones: iOS Settings' small grey heading over an inset group. */}
      <div className="max-md:px-4">
        <h2 className="text-sm font-semibold max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs max-md:text-[0.8125rem]">
            {description}
          </p>
        )}
      </div>
      <div
        data-slot="settings-group"
        className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)"
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
  children,
}: {
  /** The field's id, so the title labels it (and error toasts can name it). */
  id: string;
  title: string;
  description?: ReactNode;
  suffix?: ReactNode;
  stacked?: boolean;
  children: ReactNode;
}) {
  if (stacked) {
    return (
      <div data-slot="settings-row" data-stacked="" className="space-y-1.5 px-4 py-3.5">
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
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 max-md:grid max-md:grid-cols-[fit-content(50%)_minmax(0,1fr)] max-md:gap-y-0 max-md:py-0"
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
        className="w-full shrink-0 max-md:col-start-2 max-md:row-start-1 max-md:flex max-md:min-w-0 max-md:justify-end sm:w-auto"
      >
        {children}
      </div>
    </div>
  );
}
