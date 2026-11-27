import type { TrackingIds } from '@ll/content';
import { Link } from '@tanstack/react-router';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { InfoTip } from '@/components/info-tip';
import { ServicesSection } from '@/components/integrations/services-section';
import { TrackingSection } from '@/components/integrations/tracking-section';
import { useRevealOnce } from '@/lib/use-reveal-once';
import type { ServiceStatuses } from '@/server/service-status';

/** The outside services the website and the CMS work with: the website's tags, and the connected services. */
export function AppsPage({
  tracking,
  services,
  bookingConfirmations,
}: {
  tracking: TrackingIds;
  services: ServiceStatuses;
  bookingConfirmations: boolean;
}) {
  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-3xl space-y-8"
    >
      <div className="space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Apps" />
        </h1>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          The outside services the website and the CMS work with.
          <InfoTip label="About this page">
            <p>
              The website's tags come first. Visitors are asked before any of them load, in the
              cookie banner, and each loads only once they accept its group. You can change the
              banner's wording in{' '}
              <Link
                to="/settings"
                hash="cookies"
                className="text-foreground underline underline-offset-4"
              >
                Settings
              </Link>
              .
            </p>
            <p>Leave an id blank to use the one the site was built with.</p>
            <p>
              A developer connects the services below on the server, so ask them to connect one that
              is not set up. The keys themselves are never shown.
            </p>
          </InfoTip>
        </p>
      </div>

      <TrackingSection saved={tracking} />

      <ServicesSection status={services} bookingConfirmations={bookingConfirmations} />
    </div>
  );
}
