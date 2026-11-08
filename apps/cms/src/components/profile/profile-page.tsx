import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { CameraIcon, MailIcon } from '@/components/icons';
import { FormCell, FormSection, groupHeadingClass } from '@/components/form-cells';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import { PageActions } from '@/components/shell/page-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { reportInvalid } from '@/lib/form-validation';
import { type SessionUser, forgetCachedUser } from '@/lib/session';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';

async function uploadAvatar(file: File) {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/avatar', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) throw new Error(body?.error ?? 'Upload failed.');
  return body.url;
}

export function ProfilePage({
  user,
  justConfirmedEmail,
}: {
  user: SessionUser;
  justConfirmedEmail: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [imageAlt, setImageAlt] = useState(user.imageAlt ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending } = useAction();

  useEffect(() => {
    if (justConfirmedEmail) {
      notify.success({
        id: 'email-confirmed',
        title: 'Email confirmed',
        description: 'Sign in with the new address from now on.',
      });
    }
  }, [justConfirmedEmail]);

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function refresh() {
    forgetCachedUser();
    await router.invalidate();
  }

  async function uploadPicked(file: File) {
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      await authClient.updateUser({ image: url });
      await refresh();
      notify.success({ title: 'Photo updated', description: 'It shows wherever your name does.' });
    } catch (error) {
      notify.error('Could not update the photo', error);
    } finally {
      setAvatarUploading(false);
    }
  }

  // Photos are cropped square first; they show in a circle.
  const crop = useImageUpload<void>({ aspect: 1, upload: uploadPicked, onUploaded: () => {} });

  const dirty =
    name !== user.name || bio !== (user.bio ?? '') || imageAlt !== (user.imageAlt ?? '');

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    await run(
      async () => {
        const { error } = await authClient.updateUser({
          name,
          bio: bio || null,
          imageAlt: imageAlt.trim() || null,
        });
        if (error) throw new Error(error.message ?? 'Could not save your profile.');
        await refresh();
      },
      {
        success: {
          title: 'Profile saved',
          description: 'Your details are updated across the CMS.',
        },
        error: 'Could not save your profile',
      }
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Your profile
        </h1>
        <p className="text-muted-foreground text-sm">
          How you appear and sign in to the Living Legacy CMS.
        </p>
      </div>

      <div className="space-y-8">
        {/* Phones: Save in the top bar, as iOS edits a profile. */}
        <PageActions
          primary={
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={() => formRef.current?.requestSubmit()}
            >
              Save
            </button>
          }
        />
        {/* Phones: the photo and name centred over the groups, as iOS's account page. */}
        <div className="flex items-center gap-4 max-md:flex-col max-md:gap-2 max-md:text-center">
          <div className="group relative">
            <Avatar size="lg" className="size-16">
              {user.image && <AvatarImage src={user.image} alt={user.imageAlt ?? ''} />}
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              aria-label="Change photo"
              disabled={avatarUploading}
              onClick={() => fileInput.current?.click()}
              className="bg-background absolute inset-0 flex items-center justify-center rounded-full opacity-0 ring-1 ring-black/10 transition-opacity group-hover:opacity-90 disabled:opacity-90"
            >
              {avatarUploading ? <Spinner /> : <CameraIcon aria-hidden className="size-4" />}
            </button>
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
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {user.role}
            </Badge>
          </div>
        </div>

        <form
          ref={formRef}
          noValidate
          onSubmit={saveProfile}
          className="space-y-5 [--form-gap:1.25rem] max-md:space-y-7"
        >
          <FormSection>
            <FormCell label="Name" htmlFor="profile-name">
              <Input
                id="profile-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-xs"
              />
            </FormCell>
            <FormCell label="Bio" htmlFor="profile-bio">
              <Textarea
                id="profile-bio"
                rows={3}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A line or two about you"
              />
            </FormCell>
            {user.image && (
              <FormCell
                label="Photo alt text"
                htmlFor="profile-photo-alt"
                hint="Read out by screen readers."
              >
                <Input
                  id="profile-photo-alt"
                  maxLength={300}
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Describe your photo"
                />
              </FormCell>
            )}
          </FormSection>
          <Button
            type="submit"
            variant="outline"
            className="max-md:hidden"
            disabled={pending || !dirty}
          >
            {pending ? <Spinner /> : null}
            Save
          </Button>
        </form>

        <ChangeEmail currentEmail={user.email} />
      </div>
    </div>
  );
}

function ChangeEmail({ currentEmail }: { currentEmail: string }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      notify.error('Nothing to change', "That's already your email.");
      return;
    }
    setPending(true);
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim(),
      callbackURL: '/profile?emailConfirmed=yes',
    });
    setPending(false);
    if (error) {
      notify.error('Could not send the link', error.message ?? 'Please try again.');
      return;
    }
    setSentTo(newEmail.trim());
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="profile-email" className={groupHeadingClass}>
        Email
      </Label>
      <div className="flex items-center gap-2 max-md:min-h-11 max-md:rounded-[10px] max-md:bg-(--ios-cell) max-md:pr-2">
        <div className="bg-muted/60 text-muted-foreground text-ui flex h-8 max-w-xs flex-1 items-center gap-2 rounded-md px-3 max-md:bg-transparent max-md:px-4 max-md:text-[1.0625rem]">
          <MailIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{currentEmail}</span>
        </div>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            className="max-md:text-tint max-md:border-0 max-md:bg-transparent max-md:text-[1.0625rem] max-md:shadow-none"
            onClick={() => setEditing(true)}
          >
            Change
          </Button>
        )}
      </div>

      {editing && (
        <form noValidate onSubmit={send} className="flex gap-2 pt-1">
          <Input
            id="profile-email"
            type="email"
            required
            placeholder="new@address.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Send link
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}

      {sentTo && (
        <p className="text-muted-foreground pt-1 text-xs">
          We sent a confirmation link to <span className="text-foreground">{sentTo}</span>. Your
          sign-in email changes once you click it.
        </p>
      )}
      <p className="text-muted-foreground text-xs max-md:px-4 max-md:text-[0.8125rem]">
        There is no password; this is also what you sign in with.
      </p>
    </div>
  );
}
