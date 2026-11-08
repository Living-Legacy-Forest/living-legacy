import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from '@/components/icons';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * How long a toast stays up. The countdown line along its bottom edge
 * (styles.css) runs for the same time, read from --toast-duration. A toast
 * given its own `duration` should pass a matching `--toast-duration` style.
 */
const DURATION = 5000;

// Title, description and action come from Sonner:
//   toast.success('Post published', {
//     description: 'It is live on the website.',
//     action: { label: 'View', onClick: () => … },
//   });
const Toaster = ({ ...props }: ToasterProps) => {
  // Phones: a banner that drops in under the notch, like an iOS notification,
  // and swipes back up to go. Wider screens keep the corner stack.
  const isPhone = useIsMobile();
  const phone: Partial<ToasterProps> = isPhone
    ? {
        position: 'top-center',
        // Sonner's own phone layout starts below 600px; phones here go to 767px.
        offset: { top: 'calc(env(safe-area-inset-top) + 8px)' },
        mobileOffset: { top: 'calc(env(safe-area-inset-top) + 8px)' },
        swipeDirections: ['top'],
      }
    : {};
  return (
    <Sonner
      theme="light"
      className="toaster group"
      duration={DURATION}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--toast-duration': `${DURATION}ms`,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
      {...phone}
    />
  );
};

export { Toaster };
