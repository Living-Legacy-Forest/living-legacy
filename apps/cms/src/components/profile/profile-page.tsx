import { useRouter } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CameraIcon, MailIcon } from '@/components/icons';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import { PageActions } from '@/components/shell/page-actions';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { reportInvalid } from '@/lib/form-validation';
import { enterTransition, exitTransition } from '@/lib/motion';
import { type SessionUser, forgetCachedUser } from '@/lib/session';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { avatarSrc } from '@/lib/avatar';
import { AvatarPicker } from '@/components/avatar-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clearMyPicture, setMyAvatar } from '@/server/profile';
import { ActivityCalendar } from '@/components/activity/activity-calendar';
import type { ActivityDay } from '@/server/activity-log';
import { AppearanceSection } from './appearance-section';
import { ProfileBanner } from './profile-banner';
import { DevicesSection } from './devices-section';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

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
  activity,
  justConfirmedEmail,
}: {
  user: SessionUser;
  /** Your changes per day over the past year. */
  activity: ActivityDay[];
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
  const reduce = useReducedMotion() ?? false;

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

  const [picking, setPicking] = useState(false);
  const hasPicture = Boolean(user.image || user.avatarSeed);

  async function chooseAvatar(seed: string) {
    await run(
      async () => {
        await setMyAvatar({ data: { seed } });
        setImageAlt('');
        await refresh();
      },
      {
        success: { title: 'Avatar chosen', description: 'It shows wherever your name does.' },
        error: 'Could not use that avatar',
      }
    );
  }

  async function removePicture() {
    await run(
      async () => {
        await clearMyPicture();
        setImageAlt('');
        await refresh();
      },
      {
        success: { title: 'Picture removed', description: 'Your initials show instead.' },
        error: 'Could not remove the picture',
      }
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  });

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-4xl"
    >
      <div className="mb-8 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Your profile" />
        </h1>
        <p className="text-muted-foreground text-sm">
          How you appear and sign in to the Living Legacy CMS.
        </p>
      </div>

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

      <div className="space-y-10">
        {/* Who you are at a glance: the banner, with the avatar overlapping its lower edge, as on X.
            Phones: centred, as iOS's account page. */}
        <div>
          <ProfileBanner banner={user.banner} seed={user.id} onChanged={refresh} />
          <div className="-mt-12 flex flex-col gap-3 px-4 max-md:items-center max-md:text-center">
            <div className="group relative shrink-0 self-start max-md:self-center">
              <Avatar
                size="lg"
                className="ring-background ring-4 after:hidden data-[size=lg]:size-24"
              >
                {avatarSrc(user) && <AvatarImage src={avatarSrc(user)} alt={user.imageAlt ?? ''} />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Change picture"
                  disabled={avatarUploading}
                  className="focus-visible:ring-ring touch:items-end touch:justify-end touch:bg-transparent touch:text-foreground touch:opacity-100 absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 disabled:opacity-100 data-popup-open:opacity-100"
                >
                  {/* Touch screens have no hover to reveal the overlay, so the camera sits on a badge. */}
                  <span className="touch:bg-background touch:ring-foreground/10 touch:flex touch:size-7 touch:items-center touch:justify-center touch:rounded-full touch:shadow-sm touch:ring-1 contents">
                    {avatarUploading ? (
                      <Spinner />
                    ) : (
                      <CameraIcon aria-hidden className="touch:size-4 size-5" />
                    )}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                    Upload a photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPicking(true)}>
                    Choose an avatar
                  </DropdownMenuItem>
                  {hasPicture && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={removePicture}>
                        Remove picture
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <AvatarPicker
                open={picking}
                onOpenChange={setPicking}
                current={user.avatarSeed}
                onPick={chooseAvatar}
              />
              {/* Touch screens have no hover to reveal the camera: show it as a badge. */}
              <span
                aria-hidden
                className="bg-background text-foreground touch:flex pointer-events-none absolute right-0 bottom-0 hidden size-7 items-center justify-center rounded-full border shadow-sm"
              >
                <CameraIcon className="size-3.5" />
              </span>
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
            <div className="min-w-0 space-y-1.5">
              <div>
                <p className="truncate text-base font-semibold">{user.name}</p>
                <p className="text-muted-foreground truncate text-sm">{user.email}</p>
              </div>
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs max-md:justify-center">
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
                Member since {memberSince}
              </p>
              {user.bio && <p className="max-w-prose text-sm">{user.bio}</p>}
              {/* Nobody is given a face: until they choose, they see this prompt. */}
              {!hasPicture && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => setPicking(true)}
                >
                  Choose an avatar
                </Button>
              )}
            </div>
          </div>
        </div>

        <form ref={formRef} noValidate onSubmit={saveProfile}>
          <SettingsSection
            id="profile"
            title="Profile"
            description="Shown next to your work across the CMS."
          >
            <SettingsRow id="profile-name" title="Name">
              <Input
                id="profile-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full sm:w-72"
              />
            </SettingsRow>
            <SettingsRow id="profile-bio" title="Bio" stacked>
              <Textarea
                id="profile-bio"
                rows={3}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A line or two about you"
              />
            </SettingsRow>
            {user.image && (
              <SettingsRow
                id="profile-photo-alt"
                title="Photo description"
                description="Read out by screen readers in place of your photo."
              >
                <Input
                  id="profile-photo-alt"
                  maxLength={300}
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Describe your photo"
                  className="w-full sm:w-72"
                />
              </SettingsRow>
            )}
          </SettingsSection>

          {/* Only there while something is unsaved, so it takes no room otherwise. */}
          <AnimatePresence initial={false}>
            {dirty && (
              <motion.div
                key="unsaved-bar"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduce
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, y: 8, transition: exitTransition }
                }
                transition={enterTransition}
                className="bg-background/95 sticky bottom-[calc(var(--tab-bar-height)+1rem)] z-10 mt-4 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur max-md:hidden"
              >
                <span className="mr-auto text-sm">You have unsaved changes.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setName(user.name);
                    setBio(user.bio ?? '');
                    setImageAlt(user.imageAlt ?? '');
                  }}
                >
                  Discard
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Spinner /> : null}
                  Save changes
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <SettingsSection
          id="activity"
          title="Your activity"
          description="What you have changed in the CMS over the past year, a square a day."
          framed
        >
          {/* The heatmap pins its weekday labels over the grid in the colour it sits on. */}
          <div className="p-4 [--heatmap-surface:var(--background)] max-md:[--heatmap-surface:var(--ios-cell)]">
            <ActivityCalendar days={activity} label="Your changes over the past year" />
          </div>
        </SettingsSection>
        <ChangeEmail currentEmail={user.email} />
        <AppearanceSection />
        <DevicesSection />
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
    <SettingsSection
      id="sign-in"
      title="Sign-in"
      description="There is no password: you sign in with a link sent to this address."
    >
      <SettingsRow id="profile-email" title="Email">
        <div className="flex items-center gap-2 max-md:justify-end">
          <span className="text-muted-foreground text-ui flex min-w-0 items-center gap-2">
            <MailIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{currentEmail}</span>
          </span>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          )}
        </div>
      </SettingsRow>
      {editing && (
        <form noValidate onSubmit={send} className="flex flex-wrap gap-2 max-md:px-4 max-md:py-3">
          <Input
            id="profile-email"
            type="email"
            maxLength={254}
            required
            placeholder="new@address.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full sm:w-72"
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
        <p className="text-muted-foreground text-xs max-md:px-4 max-md:py-3">
          We sent a confirmation link to <span className="text-foreground">{sentTo}</span>. Your
          sign-in email changes once you click it.
        </p>
      )}
    </SettingsSection>
  );
}
