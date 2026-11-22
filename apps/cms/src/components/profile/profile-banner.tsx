import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { CameraIcon } from '@/components/icons';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { BANNER_ASPECT, bannerHueShift, imageFailed } from '@/lib/banner';
import { notify } from '@/lib/notify';
import { clearMyBanner, setMyBanner } from '@/server/profile';

async function uploadBannerFile(file: File) {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/banner', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) throw new Error(body?.error ?? 'Upload failed.');
  return body.url;
}

/**
 * The wide strip across the top of the profile, with its own edit menu. Until a banner is
 * uploaded, or when its file cannot be loaded, a soft gradient from the CMS colour fills it.
 * Decorative, so it is hidden from screen readers and needs no description.
 */
export function ProfileBanner({
  banner,
  seed,
  onChanged,
}: {
  banner: string | null;
  /** Varies the default gradient from person to person; their id. */
  seed: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A new banner may load where the old file did not.
  useEffect(() => {
    setBroken(false);
  }, [banner]);

  async function save(file: File) {
    setBusy(true);
    try {
      await setMyBanner({ data: { url: await uploadBannerFile(file) } });
      await onChanged();
      notify.success({
        title: 'Banner updated',
        description: 'It shows across the top of your profile.',
      });
    } catch (error) {
      notify.error('Could not update the banner', error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await clearMyBanner();
      await onChanged();
      notify.success({
        title: 'Banner removed',
        description: 'The default gradient shows instead.',
      });
    } catch (error) {
      notify.error('Could not remove the banner', error);
    } finally {
      setBusy(false);
    }
  }

  // Banners are cropped wide first, then saved.
  const crop = useImageUpload<void>({ aspect: BANNER_ASPECT, upload: save, onUploaded: () => {} });

  return (
    <div className="bg-muted relative aspect-[3/1] max-h-52 w-full overflow-hidden rounded-xl max-md:aspect-[2.4/1]">
      {banner && !broken ? (
        <img
          src={banner}
          alt=""
          aria-hidden
          ref={(img) => {
            if (img && imageFailed(img)) setBroken(true);
          }}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="profile-banner-default size-full"
          style={{ '--banner-shift': bannerHueShift(seed) } as CSSProperties}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Change banner"
          disabled={busy}
          className="bg-background/80 text-foreground hover:bg-background focus-visible:ring-ring touch:size-11 absolute top-3 right-3 flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur outline-none focus-visible:ring-2 disabled:opacity-90"
        >
          {busy ? <Spinner /> : <CameraIcon aria-hidden className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => fileInput.current?.click()}>
            Upload a banner
          </DropdownMenuItem>
          {banner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={remove}>
                Remove banner
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) crop.start(file);
          e.target.value = '';
        }}
      />
      {crop.dialog}
    </div>
  );
}
