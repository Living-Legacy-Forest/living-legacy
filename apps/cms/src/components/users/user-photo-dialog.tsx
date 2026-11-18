import { useRouter } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import {} from '@/components/icons';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { type Notice, notify } from '@/lib/notify';
import { forgetCachedUser } from '@/lib/session';
import { IMAGE_ACCEPT } from '@/lib/upload-media';
import { updateUserPhoto } from '@/server/users';
import { avatarSrc } from '@/lib/avatar';
import { AvatarPicker } from '@/components/avatar-picker';

type PhotoUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  imageAlt: string | null;
  avatarSeed: string | null;
};

async function uploadAvatarFor(userId: string, file: File) {
  const form = new FormData();
  form.set('file', file);
  form.set('userId', userId);
  const res = await fetch('/api/avatar', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) throw new Error(body?.error ?? 'Upload failed.');
  return body.url;
}

/** An admin's view of someone's photo: upload, remove, and its alt text. */
export function UserPhotoDialog({
  user,
  isSelf,
  initials,
  open,
  onOpenChange,
}: {
  user: PhotoUser;
  isSelf: boolean;
  initials: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const label = user.name || user.email;
  const [alt, setAlt] = useState(user.imageAlt ?? '');
  const [busy, setBusy] = useState<null | 'upload' | 'remove' | 'save' | 'avatar'>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function act(
    kind: 'upload' | 'remove' | 'save' | 'avatar',
    action: () => Promise<void>,
    done: Notice,
    failure: string
  ) {
    setBusy(kind);
    try {
      await action();
      if (isSelf) forgetCachedUser();
      await router.invalidate();
      notify.success(done);
      return true;
    } catch (error) {
      notify.error(failure, error);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const upload = (file: File) =>
    act(
      'upload',
      async () => {
        const url = await uploadAvatarFor(user.id, file);
        // Your own photo goes through Better Auth so your session sees it.
        if (isSelf) await authClient.updateUser({ image: url });
      },
      { title: 'Photo updated', description: 'It shows wherever their name does.' },
      'Could not update the photo'
    );

  // Photos are cropped square first; they show in a circle.
  const crop = useImageUpload<void>({
    aspect: 1,
    upload: async (file) => {
      await upload(file);
    },
    onUploaded: () => {},
  });

  const remove = () =>
    act(
      'remove',
      async () => {
        await updateUserPhoto({ data: { userId: user.id, remove: true } });
        setAlt('');
      },
      { title: 'Picture removed', description: 'Their initials show in its place.' },
      'Could not remove the picture'
    );

  const [picking, setPicking] = useState(false);
  const chooseAvatar = async (seed: string) => {
    await act(
      'avatar',
      async () => {
        await updateUserPhoto({ data: { userId: user.id, avatarSeed: seed } });
        setAlt('');
      },
      { title: 'Avatar chosen', description: 'It shows wherever their name does.' },
      'Could not use that avatar'
    );
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await act(
      'save',
      () => updateUserPhoto({ data: { userId: user.id, imageAlt: alt } }),
      { title: 'Alt text saved', description: 'Screen readers use it to describe the photo.' },
      'Could not save the alt text'
    );
    if (ok) onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setAlt(user.imageAlt ?? '');
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{isSelf ? 'Your photo' : `${label}'s photo`}</DialogTitle>
              <DialogDescription>Shown next to their name across the CMS.</DialogDescription>
            </DialogHeader>

            <div className="my-5 space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {avatarSrc(user) && (
                    <AvatarImage src={avatarSrc(user)} alt={user.imageAlt ?? ''} />
                  )}
                  <AvatarFallback className="bg-muted text-base font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) crop.start(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => fileInput.current?.click()}
                  >
                    {busy === 'upload' && <Spinner />}
                    {user.image ? 'Replace' : 'Upload'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setPicking(true)}
                  >
                    {busy === 'avatar' && <Spinner />}
                    Choose an avatar
                  </Button>
                  <AvatarPicker
                    open={picking}
                    onOpenChange={setPicking}
                    current={user.avatarSeed}
                    onPick={chooseAvatar}
                    title={`Choose an avatar for ${user.name}`}
                  />
                  {(user.image || user.avatarSeed) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busy !== null}
                      onClick={remove}
                    >
                      {busy === 'remove' && <Spinner />}
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-photo-alt">Alt text</Label>
                <Input
                  id="user-photo-alt"
                  maxLength={300}
                  value={alt}
                  disabled={!user.image}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder={user.image ? 'Describe the photo' : 'Upload a photo first'}
                />
                <p className="text-muted-foreground text-xs">Read out by screen readers.</p>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
              <Button
                type="submit"
                disabled={busy !== null || !user.image || alt === (user.imageAlt ?? '')}
              >
                {busy === 'save' && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {crop.dialog}
    </>
  );
}
