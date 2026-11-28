import { useEffect, useState } from 'react';
import { LaptopIcon, SmartphoneIcon, TabletIcon } from '@/components/icons';
import { SettingsSection } from '@/components/settings/settings-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatRelative } from '@/lib/format';
import { notify } from '@/lib/notify';
import { describeDevice } from '@/lib/user-agent';
import { listMyDevices, signOutDevice, signOutOtherDevices } from '@/server/profile';
import type { DeviceSession } from '@/server/session-store';

type Device = DeviceSession;

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const Icon = /iPad|Tablet/.test(userAgent ?? '')
    ? TabletIcon
    : /iPhone|Android.*Mobile|Mobile/.test(userAgent ?? '')
      ? SmartphoneIcon
      : LaptopIcon;
  return <Icon aria-hidden className="text-muted-foreground size-5 shrink-0" />;
}

/**
 * Everywhere this person is signed in, newest first, with this device on top.
 * Signing out elsewhere is for a lost laptop or a shared computer left signed in.
 */
export function DevicesSection() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setDevices(await listMyDevices());
    } catch (error) {
      notify.error('Could not load your devices', error);
      setDevices([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function signOut(device: Device) {
    setBusy(device.id);
    try {
      await signOutDevice({ data: { id: device.id } });
      notify.success({
        title: 'Signed out',
        description: `${describeDevice(device.userAgent)} is signed out within 5 minutes.`,
      });
      await load();
    } catch (error) {
      notify.error('Could not sign that device out', error);
    } finally {
      setBusy(null);
    }
  }

  async function signOutOthers() {
    setBusy('others');
    try {
      await signOutOtherDevices();
      notify.success({
        title: 'Signed out everywhere else',
        description: 'Your other devices are signed out within 5 minutes.',
      });
      await load();
    } catch (error) {
      notify.error('Could not sign the other devices out', error);
    } finally {
      setBusy(null);
    }
  }

  const others = devices?.filter((d) => !d.current) ?? [];

  return (
    <SettingsSection
      id="devices"
      title="Devices"
      framed
      description="Sign out anything you don't recognise."
    >
      {devices === null ? (
        <div className="flex items-center justify-center px-4 py-6">
          <Spinner />
        </div>
      ) : (
        <>
          {devices.map((device) => (
            <div key={device.id} className="touch:min-h-11 flex items-center gap-3 px-4 py-3">
              <DeviceIcon userAgent={device.userAgent} />
              <div className="min-w-0 flex-1">
                <p className="text-ui flex items-center gap-2 font-medium">
                  <span className="truncate">{describeDevice(device.userAgent)}</span>
                  {device.current && (
                    <Badge variant="secondary" className="shrink-0">
                      This device
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {device.current ? 'Active now' : `Active ${formatRelative(device.updatedAt)}`}
                </p>
              </div>
              {!device.current && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => signOut(device)}
                >
                  {busy === device.id ? <Spinner /> : null}
                  Sign out
                </Button>
              )}
            </div>
          ))}
          {others.length > 0 && (
            <div className="flex justify-end px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={signOutOthers}
              >
                {busy === 'others' ? <Spinner /> : null}
                Sign out of other devices
              </Button>
            </div>
          )}
        </>
      )}
    </SettingsSection>
  );
}
