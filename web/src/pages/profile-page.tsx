import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Pencil, Check, Sparkles, Captions, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api-fetch';
import { useAuth } from '@/context/auth-context';
import { updateMe } from '@/services/user';
import { useSettings, useUpdateSettings } from '@/hooks/queries/use-settings-query';
import { useCredentialsQuery, useSaveCredentials } from '@/hooks/queries/use-credentials-query';

const inputClass = 'px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-orange-500/50';

// Avatar choices: a few DiceBear styles seeded by the username, so the picker
// shows variations of "you" without any image upload.
const AVATAR_STYLES = ['thumbs', 'adventurer', 'pixel-art', 'toon-head', 'lorelei-neutral', 'initial-face', 'big-smile', 'notionists'];

function avatarOptions(seed: string): string[] {
  const s = encodeURIComponent(seed.trim() || 'nicefilm');
  return AVATAR_STYLES.map((style) => `https://api.dicebear.com/10.x/${style}/svg?seed=${s}`);
}

const SUBTITLE_LANGS = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'vi', label: 'Vietnamese' },
];

// The language word lookups are translated into (the learner's own language).
const LEARN_LANGS = [
  { id: 'vi', label: 'Vietnamese' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface border border-zinc-800 rounded-2xl p-6">{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-white mb-5 pb-4 border-b border-zinc-800">{children}</h2>;
}

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
          enabled ? 'bg-orange-500' : 'bg-zinc-700',
        )}
        role="switch"
        aria-checked={enabled}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md',
            enabled ? 'left-[calc(100%-1.375rem)]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function ProfileCard() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joined = user?.createdAt ? new Date(user.createdAt.replace(' ', 'T')) : null;
  const joinedLabel =
    joined && !Number.isNaN(joined.getTime())
      ? joined.toLocaleString('default', { month: 'long', year: 'numeric' })
      : null;

  const startEdit = () => {
    setUsername(user?.username ?? '');
    setAvatar(user?.avatar ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const name = username.trim().toLowerCase();
    if (!name) {
      setError('Username is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe({ username: name, avatar });
      updateUser(updated);
      setEditing(false);
      toast({ title: 'Profile updated' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-800 ring-2 ring-orange-500/40 shrink-0">
            <img
              src={user?.avatar}
              alt={user?.username ?? 'Avatar'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-white truncate">@{user?.username}</h3>
            {joinedLabel && <p className="text-xs text-zinc-500 mt-0.5">Member since {joinedLabel}</p>}
          </div>
          <Button variant="outline" className="rounded-lg text-sm shrink-0" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-800 ring-2 ring-orange-500/40 shrink-0">
            <img src={avatar} alt="Selected avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs font-medium text-zinc-400">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="off"
              className="mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-orange-500/50"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2">Choose an avatar</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {avatarOptions(username).map((url) => (
              <button
                key={url}
                onClick={() => setAvatar(url)}
                className={cn(
                  'relative aspect-square rounded-xl overflow-hidden bg-zinc-800 transition-all',
                  url === avatar ? 'ring-2 ring-orange-500' : 'ring-1 ring-white/10 hover:ring-white/30',
                )}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {url === avatar && (
                  <span className="absolute inset-0 flex items-center justify-center bg-orange-500/20">
                    <Check className="w-4 h-4 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="rounded-lg text-sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="rounded-lg text-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PreferencesCard() {
  const settings = useSettings();
  const update = useUpdateSettings();

  return (
    <Card>
      <CardTitle>Preferences</CardTitle>
      <div className="space-y-5">
        <Toggle
          enabled={settings.autoplayNext}
          onChange={(v) => update.mutate({ autoplayNext: v })}
          label="Auto-play next episode"
          description="Automatically start the next episode when one ends"
        />
        <div className="h-px bg-zinc-800" />
        <Toggle
          enabled={settings.learningMode}
          onChange={(v) => update.mutate({ learningMode: v })}
          label="Learn English mode"
          description="Clickable subtitles, word lookups, and a synced transcript while watching"
        />
        <div className="h-px bg-zinc-800" />
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField
            label="Default subtitle language"
            value={settings.defaultSubtitleLang}
            onValueChange={(v) => update.mutate({ defaultSubtitleLang: v })}
            options={SUBTITLE_LANGS}
          />
          <SelectField
            label="Translate words to"
            value={settings.learningLang}
            onValueChange={(v) => update.mutate({ learningLang: v })}
            options={LEARN_LANGS}
          />
        </div>
      </div>
    </Card>
  );
}

function ConfiguredBadge({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
      <Check className="w-3 h-3" /> Set
    </span>
  ) : (
    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
      Not set
    </span>
  );
}

// Per-user API keys for the optional integrations, with an explanation of why
// each is needed. Keys are write-only — the form shows status, never the secret.
function ConnectionsCard() {
  const { data: status } = useCredentialsQuery();
  const save = useSaveCredentials();
  const { toast } = useToast();

  const [gemini, setGemini] = useState('');
  const [osKey, setOsKey] = useState('');
  const [osUser, setOsUser] = useState('');
  const [osPass, setOsPass] = useState('');

  // Prefill the (non-secret) username once status loads.
  const savedUsername = status?.openSubtitlesUsername ?? '';
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOsUser(savedUsername);
  }, [savedUsername]);

  const onSave = () => {
    save.mutate(
      {
        geminiApiKey: gemini || undefined,
        openSubtitlesApiKey: osKey || undefined,
        openSubtitlesUsername: osUser || undefined,
        openSubtitlesPassword: osPass || undefined,
      },
      {
        onSuccess: () => {
          setGemini('');
          setOsKey('');
          setOsPass('');
          toast({ title: 'Connections saved' });
        },
        onError: () => toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  return (
    <Card>
      <CardTitle>Connections</CardTitle>
      <p className="text-sm text-zinc-400 -mt-2 mb-5">
        Both keys below are <span className="text-zinc-300 font-medium">optional</span> — NiceFilm works without them. Add your own (both are free) to unlock the extra features described under each. Keys are stored on your account and never shown again; leave a field blank to keep the current value.
      </p>

      {/* Gemini */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Word illustrations</h3>
          <span className="text-xs text-zinc-500">· Gemini · optional</span>
          {status && <span className="ml-auto"><ConfiguredBadge on={status.geminiKeySet} /></span>}
        </div>
        <p className="text-xs text-zinc-500">
          When you save a vocabulary word, Gemini draws a small AI "memory picture" for it so it's easier to recall during flashcard review. The rest of the learning toolkit — definitions, translations, spelling and meaning tests, spaced repetition — works without a key; your saved words just won't have a picture.{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-0.5">
            Get a free key <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <Input
          type="password"
          value={gemini}
          onChange={(e) => setGemini(e.target.value)}
          placeholder={status?.geminiKeySet ? '•••••••••• (set — type to replace)' : 'Gemini API key'}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div className="h-px bg-zinc-800 my-5" />

      {/* OpenSubtitles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Captions className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Subtitles</h3>
          <span className="text-xs text-zinc-500">· OpenSubtitles · optional</span>
          {status && <span className="ml-auto"><ConfiguredBadge on={status.openSubtitlesApiKeySet} /></span>}
        </div>
        <p className="text-xs text-zinc-500">
          Finds and downloads captions for any title, and powers Learn-English mode — where each subtitle line becomes clickable to look up words, save vocabulary, and translate sentences. Video still plays without a key; you just won't have captions or the interactive transcript. Your own key also avoids the rate limits of the shared account.{' '}
          <a href="https://www.opensubtitles.com/en/consumers" target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-0.5">
            Get an API key <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <Input
          type="password"
          value={osKey}
          onChange={(e) => setOsKey(e.target.value)}
          placeholder={status?.openSubtitlesApiKeySet ? '•••••••••• (set — type to replace)' : 'OpenSubtitles API key'}
          autoComplete="off"
          className={inputClass}
        />
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            type="text"
            value={osUser}
            onChange={(e) => setOsUser(e.target.value)}
            placeholder="Username"
            autoComplete="off"
            className={inputClass}
          />
          <Input
            type="password"
            value={osPass}
            onChange={(e) => setOsPass(e.target.value)}
            placeholder={status?.openSubtitlesPasswordSet ? '•••••• (set)' : 'Password'}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <p className="text-[11px] text-zinc-600">Username &amp; password are only needed to download subtitle files (not just search).</p>
      </div>

      <div className="flex justify-end mt-5">
        <Button variant="primary" className="rounded-lg text-sm" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save keys'}
        </Button>
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Account</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Your profile and preferences</p>
          </div>
          <Button variant="outline" onClick={logout} className="rounded-lg text-sm shrink-0">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </motion.div>

        <ProfileCard />
        <ConnectionsCard />
        <PreferencesCard />
      </div>
    </div>
  );
}
