// Checks guests in by scanning the QR code on their ticket with the phone's
// camera, like the Eventbrite Organizer app. Each scan checks the guest in
// straight away; a ticket for another date, a cancelled booking or a second
// scan is shown instead. A reference can be typed when a screen won't scan.
import { useEffect, useRef, useState } from 'react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  OctagonXIcon,
  ScanQrIcon,
  TriangleAlertIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { scanTicket, setCheckedIn } from '@/server/event-guests';
import type { EventRow } from '@/server/events';
import type { ScanResult } from '@/server/tickets';

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

/** The phone's own QR reader where it has one (Android); otherwise a WebAssembly one (iPhone). */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (native && (await native.getSupportedFormats()).includes('qr_code')) {
    return new native({ formats: ['qr_code'] });
  }
  // Browser only: in the server build this branch is dropped, so the 1 MB
  // decoder is not bundled into the Worker.
  if (import.meta.env.SSR) throw new Error('Tickets are scanned in the browser.');
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    // Served from the CMS itself rather than the library's default CDN.
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: ['qr_code'] });
}

/** The same code is not looked up again within this many milliseconds. */
const REPEAT_MS = 3000;
/** A successful check-in clears itself after this long, ready for the next guest. */
const CLEAR_MS = 4000;

export function TicketScanner({
  event,
  open,
  onOpenChange,
  onChange,
}: {
  event: EventRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Something was checked in or undone, so the guest list should reload. */
  onChange: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan tickets</DialogTitle>
          <DialogDescription>
            Point the camera at the QR code on a guest’s ticket. They are checked in as soon as it
            reads.
          </DialogDescription>
        </DialogHeader>
        {open && <Scanner event={event} onChange={onChange} />}
      </DialogContent>
    </Dialog>
  );
}

function Scanner({ event, onChange }: { event: EventRow; onChange: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'on' | 'blocked'>('starting');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  // Read inside the scan loop, which must not restart on every render.
  const paused = useRef(false);
  paused.current = busy || (result !== null && result.kind !== 'checked-in');
  const last = useRef({ code: '', at: 0 });

  async function check(code: string) {
    setBusy(true);
    try {
      const found = await scanTicket({ data: { eventId: event.id, code } });
      setResult(found);
      if (found.kind === 'checked-in') {
        navigator.vibrate?.(60);
        onChange();
      }
    } catch (error) {
      notify.error('Could not check the ticket', error);
    } finally {
      setBusy(false);
    }
  }

  // Camera and scan loop, for as long as the scanner is open.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) return;
        video.current!.srcObject = stream;
        await video.current!.play();
        setCamera('on');
      } catch {
        if (!stopped) setCamera('blocked');
        return;
      }
      const detector = await createDetector();
      const tick = async () => {
        if (stopped) return;
        const el = video.current;
        if (el && !paused.current && el.readyState >= 2) {
          try {
            const [code] = await detector.detect(el);
            const now = Date.now();
            const value = code?.rawValue ?? '';
            if (value && (value !== last.current.code || now - last.current.at > REPEAT_MS)) {
              last.current = { code: value, at: now };
              await check(value);
            }
          } catch {
            // A frame that cannot be read is skipped; the next one is tried.
          }
        }
        timer = setTimeout(tick, 200);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // Once per opening: `check` closes over the event, which does not change while open.
  }, []);

  // A successful check-in clears itself, so the next guest can step up.
  useEffect(() => {
    if (result?.kind !== 'checked-in') return;
    const timer = setTimeout(() => setResult(null), CLEAR_MS);
    return () => clearTimeout(timer);
  }, [result]);

  async function undo(id: string) {
    try {
      await setCheckedIn({ data: { id, checkedIn: false } });
      setResult(null);
      onChange();
    } catch (error) {
      notify.error('Could not undo the check-in', error);
    }
  }

  async function checkInAnyway(id: string) {
    try {
      await setCheckedIn({ data: { id, checkedIn: true } });
      setResult(null);
      onChange();
      notify.success({ title: 'Checked in', description: 'On the date their ticket is for.' });
    } catch (error) {
      notify.error('Could not check them in', error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-black sm:aspect-[4/3]">
        <video ref={video} muted playsInline className="size-full object-cover" />
        {camera === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Spinner />
          </div>
        )}
        {camera === 'blocked' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
            <ScanQrIcon aria-hidden className="size-8 opacity-70" />
            <p>
              The camera is not available. Allow camera access for this site in the browser’s
              settings, or type the reference below.
            </p>
          </div>
        )}
        {camera === 'on' && !result && (
          // A frame to aim with; the whole picture is read, not only inside it.
          <div
            aria-hidden
            className="absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]"
          />
        )}
        {result && (
          <ResultCard
            result={result}
            zone={event.timeZone}
            onUndo={undo}
            onCheckInAnyway={checkInAnyway}
            onNext={() => setResult(null)}
          />
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!typed.trim()) return;
          void check(typed).then(() => setTyped(''));
        }}
      >
        <Input
          aria-label="Booking reference"
          placeholder="Or type a reference, e.g. LL-7K3QXM"
          autoCapitalize="characters"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="touch:min-h-11"
        />
        <Button type="submit" variant="outline" disabled={busy || !typed.trim()}>
          {busy ? <Spinner /> : 'Check in'}
        </Button>
      </form>
    </div>
  );
}

const people = (n: number) => (n === 1 ? '1 person' : `${n} people`);

function ResultCard({
  result,
  zone,
  onUndo,
  onCheckInAnyway,
  onNext,
}: {
  result: ScanResult;
  zone: string;
  onUndo: (id: string) => void;
  onCheckInAnyway: (id: string) => void;
  onNext: () => void;
}) {
  const view = (() => {
    switch (result.kind) {
      case 'checked-in':
        return { tone: 'good', Icon: CircleCheckIcon, title: 'Checked in' } as const;
      case 'already':
        return {
          tone: 'warn',
          Icon: TriangleAlertIcon,
          title: 'Already checked in',
          detail: result.guest.checkedInAt
            ? `At ${formatDateTime(result.guest.checkedInAt, zone)}.`
            : undefined,
        } as const;
      case 'cancelled':
        return {
          tone: 'bad',
          Icon: OctagonXIcon,
          title: 'This booking was cancelled',
        } as const;
      case 'waitlisted':
        return {
          tone: 'warn',
          Icon: TriangleAlertIcon,
          title: 'On the waiting list',
          detail: 'No place is held for them yet. Move them into the event from the guest list.',
        } as const;
      case 'other-event':
        return {
          tone: 'warn',
          Icon: TriangleAlertIcon,
          title: 'Ticket for another date',
          detail: `${result.event.title}, ${formatDateTime(result.event.startsAt, result.event.timeZone)}.`,
        } as const;
      case 'not-found':
        return {
          tone: 'bad',
          Icon: CircleAlertIcon,
          title: 'No booking found',
          detail: 'Check the reference on their ticket, or find them in the guest list.',
        } as const;
    }
  })();
  const guest = result.kind === 'not-found' ? null : result.guest;

  return (
    <div
      role="status"
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 absolute inset-x-3 bottom-3 space-y-2 rounded-lg p-4 text-white shadow-lg duration-200 motion-reduce:animate-none',
        view.tone === 'good' && 'bg-emerald-700',
        view.tone === 'warn' && 'bg-amber-700',
        view.tone === 'bad' && 'bg-red-700'
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <view.Icon aria-hidden className="size-5 shrink-0" />
        {view.title}
      </p>
      {guest && (
        <p className="text-sm">
          <span className="font-medium">{guest.name}</span>, {people(guest.partySize)} ·{' '}
          {guest.reference}
          {guest.note && <span className="block text-white/85">Note: {guest.note}</span>}
        </p>
      )}
      {'detail' in view && view.detail && <p className="text-sm text-white/85">{view.detail}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {result.kind === 'checked-in' && (
          <Button size="sm" variant="secondary" onClick={() => onUndo(result.guest.id)}>
            Undo
          </Button>
        )}
        {result.kind === 'other-event' && !result.guest.checkedInAt && (
          <Button size="sm" variant="secondary" onClick={() => onCheckInAnyway(result.guest.id)}>
            Check in anyway
          </Button>
        )}
        {result.kind !== 'checked-in' && (
          <Button size="sm" variant="secondary" onClick={onNext}>
            Scan next
          </Button>
        )}
      </div>
    </div>
  );
}
