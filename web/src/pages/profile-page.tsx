import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Play,
  Bell,
  Globe,
  CreditCard,
  Monitor,
  Check,
  Crown,
  Pencil,
  Laptop,
  Smartphone,
  Tv,
  Trash2,
  Shield,
  Calendar,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useSettings, useUpdateSettings } from '@/hooks/queries/use-settings-query';
import { SelectField } from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionId = 'profile' | 'playback' | 'notifications' | 'language' | 'subscription' | 'devices'

interface NavItem {
  id: SectionId
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'playback', label: 'Playback', icon: <Play className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'language', label: 'Language', icon: <Globe className="w-4 h-4" /> },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

interface ToggleProps {
  enabled: boolean
  onChange: (val: boolean) => void
  label?: string
  description?: string
}

function Toggle({ enabled, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-medium text-white">{label}</p>}
          {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
        </div>
      )}
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

// ---------------------------------------------------------------------------
// Select Dropdown
// ---------------------------------------------------------------------------

interface SelectProps {
  value: string
  options: string[]
  onChange: (val: string) => void
  label?: string
}

function Select({ value, options, onChange, label }: SelectProps) {
  return (
    <SelectField
      label={label}
      value={value}
      onValueChange={onChange}
      options={options.map((opt) => ({ id: opt, label: opt }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface border border-zinc-800 rounded-2xl p-6', className)}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-white mb-5 pb-4 border-b border-zinc-800">{children}</h2>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function ProfileSection() {
  const { user } = useAuth();
  const joined = user?.createdAt ? new Date(user.createdAt.replace(' ', 'T')) : null;
  const joinedLabel =
    joined && !Number.isNaN(joined.getTime())
      ? joined.toLocaleString('default', { month: 'long', year: 'numeric' })
      : null;

  return (
    <SectionCard>
      <SectionTitle>Profile</SectionTitle>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-800 ring-2 ring-orange-500/40">
            <img
              src={user?.avatar}
              alt={user?.username ?? 'Avatar'}
              className="w-full h-full object-cover"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = 'none';
                t.parentElement!.classList.add('flex', 'items-center', 'justify-center');
              }}
            />
          </div>
          <button className={cn(buttonVariants({ variant: 'primary' }), 'absolute -bottom-2 -right-2 w-7 h-7 rounded-full p-0 border-2 border-surface')}>
            <Pencil className="w-3 h-3 text-white" />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h3 className="text-xl font-bold text-white">@{user?.username}</h3>
          </div>
          {joinedLabel && (
            <p className="text-xs text-zinc-600">Member since {joinedLabel}</p>
          )}
        </div>

        {/* Edit button */}
        <Button variant="outline" className="rounded-lg text-sm">
          <Pencil className="w-3.5 h-3.5" />
          Edit Profile
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-zinc-800">
        {[
          { label: 'Titles Watched', value: '148' },
          { label: 'Hours Spent', value: '312h' },
          { label: 'Saved Titles', value: '24' },
        ].map((stat) => (
          <div key={stat.label} className="text-center rounded-xl bg-surface-2 py-3 px-2">
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

const QUALITY_OPTS = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p Full HD', value: '1080' },
  { label: '720p HD', value: '720' },
  { label: '480p', value: '480' },
];

const LANG_OPTS = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
];

function PlaybackSection() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const [speed, setSpeed] = useState('1x (Normal)');
  const [downloadQuality, setDownloadQuality] = useState('1080p');

  const qualityLabel = QUALITY_OPTS.find((o) => o.value === settings.defaultQuality)?.label ?? 'Auto';
  const langLabel = LANG_OPTS.find((o) => o.value === settings.defaultSubtitleLang)?.label ?? 'English';

  return (
    <SectionCard>
      <SectionTitle>Playback Settings</SectionTitle>
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
          description="Show clickable subtitles, word lookups, and a synced transcript while watching"
        />
        <div className="h-px bg-zinc-800" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Video Quality"
            value={qualityLabel}
            options={QUALITY_OPTS.map((o) => o.label)}
            onChange={(label) =>
              update.mutate({ defaultQuality: QUALITY_OPTS.find((o) => o.label === label)?.value ?? 'auto' })
            }
          />
          <Select
            label="Subtitle Language"
            value={langLabel}
            options={LANG_OPTS.map((o) => o.label)}
            onChange={(label) =>
              update.mutate({ defaultSubtitleLang: LANG_OPTS.find((o) => o.label === label)?.value ?? 'en' })
            }
          />
          <Select
            label="Playback Speed"
            value={speed}
            options={['0.5x', '0.75x', '1x (Normal)', '1.25x', '1.5x', '2x']}
            onChange={setSpeed}
          />
          <Select
            label="Download Quality"
            value={downloadQuality}
            options={['Standard (480p)', '720p HD', '1080p Full HD']}
            onChange={setDownloadQuality}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState({
    newReleases: true,
    episodeReminders: true,
    recommendations: false,
    emailNotifs: true,
    pushNotifs: false,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const items = [
    { key: 'newReleases' as const, label: 'New Releases', description: 'Get notified when new content is added' },
    { key: 'episodeReminders' as const, label: 'Episode Reminders', description: 'Reminders for upcoming episodes' },
    { key: 'recommendations' as const, label: 'Recommendations', description: 'Personalized content suggestions' },
    { key: 'emailNotifs' as const, label: 'Email Notifications', description: 'Receive updates via email' },
    { key: 'pushNotifs' as const, label: 'Push Notifications', description: 'Browser and device push alerts' },
  ];

  return (
    <SectionCard>
      <SectionTitle>Notification Preferences</SectionTitle>
      <div className="space-y-5">
        {items.map((item, i) => (
          <div key={item.key}>
            <Toggle
              enabled={settings[item.key]}
              onChange={() => toggle(item.key)}
              label={item.label}
              description={item.description}
            />
            {i < items.length - 1 && <div className="h-px bg-zinc-800 mt-5" />}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function LanguageSection() {
  const [interfaceLang, setInterfaceLang] = useState('English');
  const [contentLang, setContentLang] = useState('All Languages');
  const [subtitlePref, setSubtitlePref] = useState('English');

  return (
    <SectionCard>
      <SectionTitle>Language & Region</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-5">
        <Select
          label="Interface Language"
          value={interfaceLang}
          options={['English', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Portuguese']}
          onChange={setInterfaceLang}
        />
        <Select
          label="Content Language"
          value={contentLang}
          options={['All Languages', 'English', 'Spanish', 'French', 'Korean', 'Japanese']}
          onChange={setContentLang}
        />
        <Select
          label="Default Subtitle Language"
          value={subtitlePref}
          options={['Off', 'English', 'Spanish', 'French', 'Japanese', 'Korean']}
          onChange={setSubtitlePref}
        />
      </div>
    </SectionCard>
  );
}

const planFeatures = [
  'Unlimited movies & TV series',
  '4K Ultra HD streaming',
  'Up to 4 screens at once',
  'Offline downloads',
  'Ad-free experience',
  'Early access to new releases',
];

function SubscriptionSection() {
  return (
    <SectionCard>
      <SectionTitle>Subscription Plan</SectionTitle>

      {/* Plan card */}
      <div className="relative rounded-xl overflow-hidden bg-linear-to-br from-orange-900/30 via-surface-2 to-surface-2 border border-orange-500/20 p-5 mb-5">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-orange-400" />
              <span className="text-lg font-bold text-white">Premium Plan</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">$14.99</span>
              <span className="text-zinc-400 text-sm">/month</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold">
            Active
          </span>
        </div>

        <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
          {planFeatures.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-orange-400" />
              </div>
              <span className="text-xs text-zinc-300">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Renewal info */}
      <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-lg bg-surface-2 border border-zinc-800">
        <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
        <div>
          <p className="text-sm text-zinc-300">Next renewal on <span className="text-white font-medium">June 15, 2026</span></p>
          <p className="text-xs text-zinc-600 mt-0.5">Auto-renews unless cancelled</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" className="rounded-lg text-sm">
          <Crown className="w-4 h-4" />
          Manage Plan
        </Button>
        <Button variant="outline" className="rounded-lg text-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Billing History
        </Button>
      </div>
    </SectionCard>
  );
}

interface Device {
  id: string
  name: string
  type: 'laptop' | 'mobile' | 'tv'
  lastActive: string
  isCurrent?: boolean
}

const mockDevices: Device[] = [
  { id: 'd1', name: 'MacBook Pro 16"', type: 'laptop', lastActive: 'Active now', isCurrent: true },
  { id: 'd2', name: 'iPhone 14 Pro', type: 'mobile', lastActive: '2 hours ago' },
  { id: 'd3', name: 'Samsung Smart TV', type: 'tv', lastActive: 'Yesterday' },
];

const deviceIcons: Record<Device['type'], React.ReactNode> = {
  laptop: <Laptop className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
  tv: <Tv className="w-5 h-5" />,
};

function DevicesSection() {
  const [devices, setDevices] = useState<Device[]>(mockDevices);

  const removeDevice = (id: string) => setDevices((prev) => prev.filter((d) => d.id !== id));

  return (
    <SectionCard>
      <SectionTitle>Device Management</SectionTitle>

      <div className="space-y-3">
        <AnimatePresence>
          {devices.map((device) => (
            <motion.div
              key={device.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface-2 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                device.isCurrent
                  ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400',
              )}>
                {deviceIcons[device.type]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{device.name}</p>
                  {device.isCurrent && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-[10px] font-semibold">
                      This device
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{device.lastActive}</p>
              </div>

              {!device.isCurrent && (
                <Button
                  variant="destructive"
                  onClick={() => removeDevice(device.id)}
                  className="shrink-0 rounded-lg text-xs px-3 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <p className="flex items-center gap-2 text-xs text-zinc-600 mt-4">
        <Shield className="w-3.5 h-3.5" />
        Only you can see your device list. Remove devices you no longer use.
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

const sectionComponents: Record<SectionId, React.ReactNode> = {
  profile: <ProfileSection />,
  playback: <PlaybackSection />,
  notifications: <NotificationsSection />,
  language: <LanguageSection />,
  subscription: <SubscriptionSection />,
  devices: <DevicesSection />,
};

// ---------------------------------------------------------------------------
// ProfilePage
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Account Settings</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage your profile and preferences</p>
          </div>
          <Button variant="outline" onClick={logout} className="rounded-lg text-sm shrink-0">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left Sidebar Navigation ── */}
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-full lg:w-56 shrink-0"
          >
            <div className="bg-surface border border-zinc-800 rounded-2xl p-2 lg:sticky lg:top-24">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left group',
                    activeSection === item.id
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5',
                  )}
                >
                  <span className={activeSection === item.id ? 'text-orange-400' : 'text-zinc-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                  {activeSection === item.id && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500"
                    />
                  )}
                </button>
              ))}
            </div>
          </motion.aside>

          {/* ── Content Area ── */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                {sectionComponents[activeSection]}
              </motion.div>
            </AnimatePresence>
          </main>

        </div>
      </div>
    </div>
  );
}
