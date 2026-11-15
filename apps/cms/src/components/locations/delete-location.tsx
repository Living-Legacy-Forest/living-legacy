import { useState } from 'react';
import { Trash2Icon } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { LocationItem } from '@/server/locations';

/** The question before a location is removed; whoever shows it owns whether it is open. */
export function DeleteLocationDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
}: {
  item: Pick<LocationItem, 'name'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this location?</AlertDialogTitle>
          <AlertDialogDescription>
            “{item.name}” is removed from the location directory. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A small bin button that asks first, for the sheet. */
export function DeleteLocation({
  item,
  disabled,
  onConfirm,
}: {
  item: LocationItem;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Remove ${item.name}`}
        className="text-muted-foreground hover:text-destructive touch:size-11"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden className="size-4" />
      </Button>
      <DeleteLocationDialog item={item} open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
    </>
  );
}
