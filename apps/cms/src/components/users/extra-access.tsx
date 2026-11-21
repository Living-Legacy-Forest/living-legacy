import { type Permission, type Role } from '@ll/content';
import { groupBoxClass, groupHeadingClass } from '@/components/form-cells';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { applyExtraChange, extraAccessGroups, permissionState } from './extra-access-rules';

/**
 * What a person can do on top of their role. Boxes the role already covers are ticked and
 * locked, and never part of `value`. This only shapes what an admin picks; the server decides
 * what a person may do.
 */
export function ExtraAccess({
  role,
  value,
  onChange,
  disabled = false,
}: {
  role: Role;
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  if (role === 'admin') {
    return <p className="text-muted-foreground text-sm">Admins can do everything.</p>;
  }

  return (
    <div className="space-y-5 max-md:space-y-6">
      {extraAccessGroups.map((group) => (
        <fieldset key={group.heading} className="min-w-0 space-y-2 max-md:space-y-1.5">
          <legend className={cn('mb-2 text-sm font-medium max-md:mb-1.5', groupHeadingClass)}>
            {group.heading}
          </legend>
          <div className={cn(groupBoxClass, 'divide-y max-md:divide-(--ios-separator)')}>
            {group.items.map((item) => {
              const state = permissionState(role, value, item.permission);
              const off = disabled || state.locked;
              return (
                <label
                  key={item.permission}
                  className={cn(
                    'touch:min-h-11 flex items-start gap-3 px-3 py-2.5',
                    off ? 'cursor-default' : 'hover:bg-muted/40 cursor-pointer'
                  )}
                >
                  <Checkbox
                    // Base UI's root is a span, so the `disabled:` styles never match; it sets
                    // data-disabled instead.
                    className="mt-0.5 data-disabled:opacity-50"
                    checked={state.checked}
                    disabled={off}
                    onCheckedChange={(on) =>
                      onChange(applyExtraChange(role, value, item.permission, on === true))
                    }
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm">{item.label}</span>
                    {(state.note ?? item.hint) && (
                      <span className="text-muted-foreground text-xs">
                        {state.note ?? item.hint}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
