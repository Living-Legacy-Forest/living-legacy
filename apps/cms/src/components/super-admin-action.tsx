import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * A button for something only a super admin may do and that cannot be undone, such as clearing the
 * activity log. It always asks first. The server still checks who is asking; this only keeps the
 * button away from people who cannot use it.
 */
export function SuperAdminAction({
  label,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  className,
  icon,
}: {
  label: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  className?: string;
  /** Shows just this icon, with `label` as its accessible name, for a button repeated on every row. */
  icon?: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          icon ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              disabled={pending}
              className={`text-muted-foreground hover:text-destructive touch:after:-inset-x-1 ${className ?? ''}`}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              className={`text-destructive ${className ?? ''}`}
            />
          )
        }
      >
        {pending && <Spinner data-icon={icon ? undefined : 'inline-start'} />}
        {icon ?? label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
