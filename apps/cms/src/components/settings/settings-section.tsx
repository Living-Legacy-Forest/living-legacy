import { type ReactNode, createContext, useContext } from 'react';
import { InfoTip } from '@/components/info-tip';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// The grouped sections and rows of the Settings and Profile pages: from md, a title and
// description on the left with the settings beside them; iOS Settings' inset groups on phones.

/**
 * Shows one section of a page as the whole page: the other sections render nothing, and the one
 * left takes the page's heading. The site settings use it so each section has an address of its
 * own while the form's state stays in one place.
 */
const SectionFilter = createContext<string | null>(null);

export function SettingsSectionFilter({ only, children }: { only: string; children: ReactNode }) {
  return <SectionFilter value={only}>{children}</SectionFilter>;
}

export function SettingsSection({
  id,
  title,
  description,
  framed = false,
  divided = true,
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
  /** Whether a framed group draws a line between its rows from md. Phones always do. */
  divided?: boolean;
  children: ReactNode;
}) {
  const only = useContext(SectionFilter);
  if (only !== null && only !== id) return null;
  const group = (
    <div
      data-slot="settings-group"
      data-framed={framed || undefined}
      className={cn(
        'min-w-0 max-md:divide-y max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell)',
        framed
          ? cn(
              'md:bg-muted/50 md:overflow-hidden md:rounded-lg',
              divided && 'md:divide-border/60 md:divide-y'
            )
          : 'md:space-y-6'
      )}
    >
      {children}
    </div>
  );
  if (only !== null) {
    // On a page of its own the section is the page: a title and what it is for, then the settings.
    return (
      <section id={id} className="space-y-6 max-md:space-y-4">
        <div className="space-y-1 max-md:px-4">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm text-pretty">{description}</p>
          )}
        </div>
        {group}
      </section>
    );
  }
  return (
    // From md, the title and what the section is for sit in a column on the left and the
    // settings on the right, with a rule between sections. Phones keep iOS Settings' groups.
    <section
      id={id}
      className="scroll-mt-32 max-md:space-y-1.5 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-x-10 md:pt-8 md:first:pt-0"
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
      {group}
    </section>
  );
}

export function SettingsRow({
  id,
  title,
  description,
  info,
  suffix,
  stacked = false,
  below = false,
  children,
}: {
  /** The field's id, so the title labels it (and error toasts can name it). */
  id: string;
  title: string;
  description?: ReactNode;
  /** The detail that would make the description too long, in a "?" beside the title. */
  info?: ReactNode;
  suffix?: ReactNode;
  stacked?: boolean;
  /** Phones: the control takes its own line under the title, for one too wide to sit beside it. */
  below?: boolean;
  children: ReactNode;
}) {
  const heading = info ? (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id}>{title}</Label>
      <InfoTip label={`About ${title.toLowerCase()}`}>{info}</InfoTip>
    </div>
  ) : (
    <Label htmlFor={id}>{title}</Label>
  );

  if (stacked) {
    return (
      <div
        data-slot="settings-row"
        data-stacked=""
        className="space-y-1.5 max-md:px-4 max-md:py-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          {heading}
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
        {heading}
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
