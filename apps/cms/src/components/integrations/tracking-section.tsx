import { type TrackingIds, trackingIdsProblem } from '@ll/content';
import { useBlocker } from '@tanstack/react-router';
import { useState } from 'react';
import { type BrandName, BrandLogo } from '@/components/brand-logos';
import { groupBoxClass, groupHeadingClass } from '@/components/form-cells';
import { StatusPulse } from '@/components/system/status-pulse';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { saveTrackingIds } from '@/server/tracking';

type App = {
  key: keyof TrackingIds;
  brand: BrandName;
  name: string;
  /** What it does, in a line. */
  does: string;
  /** Where to find the id, since that is the part people get stuck on. */
  where: string;
  placeholder: string;
  inputMode?: 'numeric';
};

/**
 * The apps, grouped by what a visitor agrees to in the cookie banner. Nothing here loads until
 * they say yes to its group, so saving an id does not start tracking anyone who has not agreed.
 */
const groups: { title: string; note: string; apps: App[] }[] = [
  {
    title: 'Analytics',
    note: 'These load once a visitor accepts analytics cookies.',
    apps: [
      {
        key: 'gaMeasurementIds',
        brand: 'googleanalytics',
        name: 'Google Analytics and Ads',
        does: 'Counts visits and shows where they come from.',
        where:
          'In Google Analytics: Admin, then Data streams. Separate several ids with commas, such as G-ABC123XYZ, AW-123456789.',
        placeholder: 'G-ABC123XYZ',
      },
      {
        key: 'posthogKey',
        brand: 'posthog',
        name: 'PostHog',
        does: 'Shows how people use the site, and which enquiries come from where.',
        where: 'In PostHog: Project settings, then the project API key. It starts with phc_.',
        placeholder: 'phc_…',
      },
    ],
  },
  {
    title: 'Marketing',
    note: 'These load once a visitor accepts marketing cookies.',
    apps: [
      {
        key: 'gtmId',
        brand: 'googletagmanager',
        name: 'Google Tag Manager',
        does: 'Runs the advertising tags you manage in Google Tag Manager.',
        where: 'Shown at the top of your Tag Manager workspace. It looks like GTM-ABC1234.',
        placeholder: 'GTM-ABC1234',
      },
      {
        key: 'metaPixelId',
        brand: 'meta',
        name: 'Meta pixel',
        does: 'Measures Facebook and Instagram advertising.',
        where: 'In Meta Events Manager: Data sources. It is a long number.',
        placeholder: '1234567890123456',
        inputMode: 'numeric',
      },
    ],
  },
];

export function TrackingSection({ saved }: { saved: TrackingIds }) {
  const [base, setBase] = useState(saved);
  const [values, setValues] = useState(saved);
  const { run, pending } = useAction();
  const dirty = JSON.stringify(values) !== JSON.stringify(base);
  const patch = (next: Partial<TrackingIds>) => setValues((v) => ({ ...v, ...next }));

  // Ask before leaving with unsaved changes, in the app and on tab close, as Settings does.
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = trackingIdsProblem(values);
    if (problem) {
      notify.error('Check the ids', problem);
      return;
    }
    const result = await run(() => saveTrackingIds({ data: values }), {
      success: {
        title: 'Saved',
        description: 'The website uses them within a minute or two.',
      },
      error: 'Could not save the ids',
    });
    if (result) {
      setBase(result);
      setValues(result);
    }
  }

  return (
    <>
      <form noValidate onSubmit={submit} className="space-y-8">
        {groups.map((group) => (
          <section key={group.title} className="space-y-2.5 max-md:space-y-1.5">
            <h2
              className={cn(
                'max-md:text-ui text-sm font-medium max-md:font-normal',
                groupHeadingClass
              )}
            >
              {group.title}
            </h2>
            <div className={cn(groupBoxClass, 'divide-y max-md:divide-(--ios-separator)')}>
              {group.apps.map((app) => (
                <AppRow
                  key={app.key}
                  app={app}
                  value={values[app.key]}
                  connected={base[app.key].trim() !== ''}
                  onChange={(value) => patch({ [app.key]: value })}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-xs max-md:px-4">{group.note}</p>
          </section>
        ))}

        <p className="text-muted-foreground text-xs max-md:px-4">
          Leave an id blank to use the one the site was built with.
        </p>

        {/* Only there while something is unsaved, so it never nags. */}
        <div
          className={cn(
            'bg-background/95 sticky bottom-[calc(var(--tab-bar-height)+1rem)] z-10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-all',
            dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
          )}
          aria-hidden={!dirty}
        >
          <span className="mr-auto min-w-0 truncate text-sm">
            <span className="md:hidden">Unsaved changes</span>
            <span className="max-md:hidden">You have unsaved changes.</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            tabIndex={dirty ? 0 : -1}
            onClick={() => setValues(base)}
          >
            Discard
          </Button>
          <Button type="submit" size="sm" disabled={pending} tabIndex={dirty ? 0 : -1}>
            {pending ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              <>
                Save<span className="max-md:hidden"> changes</span>
              </>
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={blocker.status === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to the ids will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AppRow({
  app,
  value,
  connected,
  onChange,
}: {
  app: App;
  value: string;
  /** Whether an id is saved, which is what the website uses; unsaved typing does not count. */
  connected: boolean;
  onChange: (value: string) => void;
}) {
  const id = `tracking-${app.key}`;
  return (
    <div className="space-y-3 px-4 py-4 max-md:py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <BrandLogo brand={app.brand} />
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor={id} className="text-sm font-medium">
              {app.name}
            </Label>
            <p className="text-muted-foreground text-xs">{app.does}</p>
          </div>
        </div>
        {connected ? (
          <StatusPulse tone="green" label="Connected" className="mt-0.5" />
        ) : (
          <span className="text-muted-foreground mt-0.5 text-xs whitespace-nowrap">Not set</span>
        )}
      </div>
      <Input
        id={id}
        value={value}
        inputMode={app.inputMode}
        placeholder={app.placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
      <p className="text-muted-foreground text-xs">{app.where}</p>
    </div>
  );
}
