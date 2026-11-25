import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type BrandName, BrandLogo } from '@/components/brand-logos';
import { groupBoxClass, groupHeadingClass } from '@/components/form-cells';
import { StatusPulse } from '@/components/system/status-pulse';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import type { ServiceStatuses } from '@/server/service-status';
import { setBookingConfirmations } from '@/server/settings';

type Service = {
  name: string;
  brand: BrandName;
  does: string;
  connected: (status: ServiceStatuses) => boolean;
  /** What an admin does to connect it, shown while it is not. */
  setup: string;
  /** Where to use or manage it. */
  link?:
    | { to: '/settings'; hash: string; label: string }
    | { to: '/uptime' | '/system' | '/integrations'; label: string };
  /** A line that is true whether or not it is connected. */
  note?: string;
  /** A setting for the service that people can change here, as the rest is set on the server. */
  control?: 'bookingConfirmations';
};

// What to do when a service is not connected, without naming secrets: who sets these up is a developer.
const ASK = 'Ask your developer to connect it.';

const services: Service[] = [
  {
    name: 'HubSpot',
    brand: 'hubspot',
    does: 'Sends event bookings to HubSpot as contacts.',
    connected: (s) => s.hubspot,
    setup: ASK,
    note: 'Website forms send enquiries to HubSpot as well. That is set when the website is built, so it is not shown here.',
  },
  {
    name: 'Cloudflare Email Service',
    brand: 'cloudflare',
    does: 'Sends sign-in links, and confirmations to guests who book on the website.',
    connected: (s) => s.email,
    setup: `${ASK} Without it, sign-in links and booking confirmations cannot be emailed.`,
    control: 'bookingConfirmations',
  },
  {
    name: 'Google sign-in',
    brand: 'google',
    does: 'Lets people sign in with their Google account.',
    connected: (s) => s.googleSignIn,
    setup: ASK,
    link: { to: '/settings', hash: 'sign-in', label: 'Turn it on or off in Settings' },
  },
  {
    name: 'Claude writing assistant',
    brand: 'claude',
    does: 'Suggests search text, summaries, tags and alt text.',
    connected: (s) => s.assistant,
    setup: `${ASK} Until then the Suggest buttons are hidden.`,
    link: { to: '/settings', hash: 'writing-assistant', label: 'Writing assistant settings' },
  },
  {
    name: 'PostHog reports',
    brand: 'posthog',
    does: 'Draws the page-view charts on the Posts list.',
    connected: (s) => s.posthogReports,
    setup: `${ASK} The charts are skipped without them. The website's own PostHog key is under Website tracking.`,
  },
  {
    name: 'Better Stack uptime',
    brand: 'betterstack',
    does: 'Shows whether the website and CMS are up.',
    connected: (s) => s.uptime,
    setup: `${ASK} The Uptime page stays empty without it.`,
    link: { to: '/uptime', label: 'Open Uptime' },
  },
  {
    name: 'Better Stack heartbeats',
    brand: 'betterstack',
    does: 'Tells Better Stack that each scheduled job ran, so a missed one raises an alert.',
    connected: (s) => s.heartbeats,
    setup: `${ASK} Nothing is pinged without it.`,
    link: { to: '/system', label: 'See the jobs on System' },
  },
  {
    name: 'Sentry',
    brand: 'sentry',
    does: 'Reports errors from the CMS, with the detail needed to fix them.',
    connected: (s) => s.sentry,
    setup:
      'Only the production deploy reports to Sentry, so this shows Not set up on local and preview versions.',
  },
  {
    name: 'Claude and other AI tools',
    brand: 'claude',
    does: 'Read posts, check wording and write drafts through an API key.',
    connected: (s) => s.apiKeys > 0,
    setup: 'Create an API key for each tool you connect.',
    link: { to: '/integrations', label: 'Manage API keys' },
  },
];

/**
 * The services the CMS is connected to, read-only. Their keys are secrets on the CMS Worker, so
 * this shows whether each is set and never what it is.
 */
export function ServicesSection({
  status,
  bookingConfirmations,
}: {
  status: ServiceStatuses;
  bookingConfirmations: boolean;
}) {
  return (
    <section className="space-y-2.5 max-md:space-y-1.5">
      <h2
        className={cn('max-md:text-ui text-sm font-medium max-md:font-normal', groupHeadingClass)}
      >
        Connected services
      </h2>
      <div className={cn(groupBoxClass, 'divide-y max-md:divide-(--ios-separator)')}>
        {services.map((service) => {
          const connected = service.connected(status);
          return (
            <div key={service.name} className="space-y-1.5 px-4 py-4 max-md:py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <BrandLogo brand={service.brand} />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-muted-foreground text-xs">{service.does}</p>
                  </div>
                </div>
                <StatusPulse
                  tone={connected ? 'green' : 'yellow'}
                  label={
                    service.name === 'Claude and other AI tools' && connected
                      ? `${status.apiKeys} ${status.apiKeys === 1 ? 'key' : 'keys'}`
                      : connected
                        ? 'Connected'
                        : 'Not set up'
                  }
                  className="mt-0.5"
                />
              </div>
              {!connected && <p className="text-muted-foreground text-xs">{service.setup}</p>}
              {service.note && <p className="text-muted-foreground text-xs">{service.note}</p>}
              {service.control === 'bookingConfirmations' && (
                <BookingConfirmationsSwitch saved={bookingConfirmations} />
              )}
              {service.link && (
                <p className="text-xs">
                  <Link
                    {...(service.link.to === '/settings'
                      ? { to: '/settings' as const, hash: service.link.hash }
                      : { to: service.link.to })}
                    className="text-foreground underline underline-offset-4"
                  >
                    {service.link.label}
                  </Link>
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs max-md:px-4">
        A developer sets these up on the server, so apart from the booking switch they cannot be
        changed here. The keys themselves are never shown.
      </p>
    </section>
  );
}

/** Saves as it is switched, like the other switches that act at once, and goes back if it fails. */
function BookingConfirmationsSwitch({ saved }: { saved: boolean }) {
  const [enabled, setEnabled] = useState(saved);
  const { run, pending } = useAction();
  const id = 'booking-confirmations';

  async function change(next: boolean) {
    setEnabled(next);
    const result = await run(() => setBookingConfirmations({ data: { enabled: next } }), {
      success: {
        title: 'Saved',
        description: next
          ? 'Guests who book on the website get a confirmation email.'
          : 'The CMS no longer emails booking confirmations.',
      },
      error: 'Could not save the switch',
    });
    if (result === undefined) setEnabled(!next);
  }

  return (
    <div className="touch:min-h-11 flex items-start justify-between gap-3 pt-1.5">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          Send booking confirmations from the CMS
        </Label>
        <p className="text-muted-foreground text-xs">
          Turn this off once HubSpot sends booking emails, so guests don't get two.
        </p>
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-2">
        {pending && <Spinner />}
        <Switch id={id} checked={enabled} disabled={pending} onCheckedChange={change} />
      </div>
    </div>
  );
}
