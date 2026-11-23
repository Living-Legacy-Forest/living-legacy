// Form fields as iOS draws them on phones: grouped sections of rows, each with
// its label on the left and its value on the right. Wider screens keep the
// stacked label, control and hint the CMS has always used; the phone look lives
// in styles.css, keyed on these data-slots.
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function FormSection({
  title,
  footer,
  children,
}: {
  /** Shown on phones only, as the small heading above the group. */
  title?: string;
  /** A note below the group; a hint on wider screens. */
  footer?: string;
  children: ReactNode;
}) {
  return (
    // A form whose fields sit further apart sets --form-gap, so wider screens keep its spacing.
    <section data-slot="form-section" className="space-y-[var(--form-gap,1rem)]">
      {title && (
        <h3 data-slot="form-section-title" className="hidden max-md:block">
          {title}
        </h3>
      )}
      <div data-slot="form-group" className="space-y-[var(--form-gap,1rem)]">
        {children}
      </div>
      {footer && (
        // On wider screens it reads as the last field's hint, so it sits as close as one.
        <p
          data-slot="form-section-footer"
          className="text-muted-foreground text-xs md:-mt-[calc(var(--form-gap,1rem)-0.375rem)]"
        >
          {footer}
        </p>
      )}
    </section>
  );
}

/** Label left and control right on phones; label above the control on wider screens, as today. */
export function FormCell({
  label,
  htmlFor,
  hint,
  error,
  aside,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  /** What is wrong with the value, shown under it; give the control aria-invalid too. */
  error?: string;
  /** A note level with the label (a character count); under the label on phones. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const labelEl = <Label htmlFor={htmlFor}>{label}</Label>;
  return (
    <div data-slot="form-cell" data-invalid={error ? '' : undefined} className="space-y-1.5">
      {aside ? (
        <div data-slot="form-label-row" className="flex items-center justify-between gap-2">
          {labelEl}
          {aside}
        </div>
      ) : (
        labelEl
      )}
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          data-slot="form-error"
          role="alert"
          className="text-destructive text-xs"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p data-slot="form-hint" className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Label (and optional description) left, Switch right, on every size. */
export function FormSwitchCell({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      data-slot="form-switch-cell"
      className="flex items-center justify-between gap-4 rounded-lg border pr-3"
    >
      {/* The label fills the row, so all of it is the target and not just the small switch. */}
      <Label
        htmlFor={id}
        className="flex-1 flex-col items-start gap-0.5 self-stretch py-2.5 pl-3 font-medium"
      >
        {label}
        {description && (
          <span data-slot="form-hint" className="text-muted-foreground text-xs font-normal">
            {description}
          </span>
        )}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Full-width content (rich text, image galleries, maps) in its own group on phones. */
export function FormBlock({
  label,
  labelId,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-slot="form-block" className="space-y-1.5">
      <Label id={labelId} htmlFor={htmlFor}>
        {label}
      </Label>
      <div data-slot="form-block-body">{children}</div>
      {hint && (
        <p data-slot="form-hint" className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A heading over a group that is not a FormSection (a table, a choice of cards): on phones, iOS's small grey heading. */
export const groupHeadingClass =
  'max-md:px-4 max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase';

/** The box a table or list sits in: bordered on wider screens, an inset group on phones. */
export const groupBoxClass =
  'overflow-hidden rounded-lg border max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell) max-md:[&_tr]:border-(--ios-separator)';
