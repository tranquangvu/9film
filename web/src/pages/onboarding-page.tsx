import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, GraduationCap, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { KEY_COPY, type KeyKind } from '@/components/system/common/key-copy';
import { useSaveCredentials } from '@/hooks/queries/use-credentials-query';
import { completeOnboarding, isOnboarded } from '@/hooks/use-onboarding';

const inputClass =
  'px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-orange-500/50';

function Note({ icon: Icon, children }: { icon: typeof ShieldAlert; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Icon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
      <p className="text-sm text-zinc-300">{children}</p>
    </div>
  );
}

// One integration: what it powers, where to get the key, and the field. Same flat
// row as Account → Connections — the long "why you need this" version belongs to
// the prompts that appear once a feature turns out to be off.
function KeyField({
  kind,
  value,
  onChange,
}: {
  kind: KeyKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const copy = KEY_COPY[kind];
  const Icon = copy.icon;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-orange-400 shrink-0" />
        <h3 className="text-sm font-semibold text-white">{copy.feature}</h3>
        <span className="text-xs text-zinc-500">· {copy.provider}</span>
        <a
          href={copy.href}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 whitespace-nowrap"
        >
          {copy.linkLabel} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-xs text-zinc-500">{copy.short}</p>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${copy.provider} API key`}
        autoComplete="off"
        className={inputClass}
      />
    </div>
  );
}

/**
 * The first-run flow, shown once before anything else: the licence notice that
 * used to sit in front of the first playback, then the two API keys the optional
 * integrations need. Keys can be skipped — the app runs without them, and the
 * watch page says so when subtitles turn out to be off.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const save = useSaveCredentials();

  // Read once, not subscribed: finishing flips the flag, and a live subscription
  // would redirect this page out from under its own navigate() call.
  const [alreadyDone] = useState(isOnboarded);

  const [step, setStep] = useState(0);
  const [subdl, setSubdl] = useState('');
  const [gemini, setGemini] = useState('');

  // Where the gate bounced us from, so finishing lands on the page that was asked
  // for rather than always on home.
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (alreadyDone) return <Navigate to="/" replace />;

  const hasKeys = subdl.trim() !== '' || gemini.trim() !== '';

  const finish = async () => {
    if (hasKeys) {
      try {
        await save.mutateAsync({
          subdlApiKey: subdl.trim() || undefined,
          geminiApiKey: gemini.trim() || undefined,
        });
      } catch {
        toast({
          title: 'Could not save your keys',
          description: 'Please try again, or skip and add them later.',
          variant: 'destructive',
        });
        return;
      }
    }
    completeOnboarding();
    navigate(from, { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* A wide, shallow ellipse hung off the top edge — light spilling down onto
          the card rather than a round glow sitting behind it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(130%_100%_at_50%_0%,rgba(249,115,22,0.20)_0%,rgba(249,115,22,0.05)_45%,transparent_75%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-lg"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <span className="text-lg font-bold tracking-tight text-gradient">9film</span>
          <div className="flex items-center gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-orange-500' : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-surface border border-zinc-800 rounded-2xl p-6">
          {step === 0 ? (
            <>
              <h1 className="text-xl font-bold text-white">Before you start</h1>
              <p className="text-sm text-zinc-500 mt-1">Read this once.</p>

              <div className="mt-4 space-y-3">
                <Note icon={ShieldAlert}>
                  9film holds <span className="text-white font-medium">no licence</span> to anything
                  it plays and hosts none of it — every stream, poster and subtitle comes from public
                  third-party sources.
                </Note>
                <Note icon={GraduationCap}>
                  It's a <span className="text-white font-medium">personal, non-commercial</span>{' '}
                  language-learning project. Whether a title is legal to watch where you are is your
                  call.
                </Note>
              </div>

              {/* New tab: leaving the flow would drop you back at step one. */}
              <p className="mt-4 text-xs text-zinc-500">
                Full terms on the{' '}
                <a
                  href="/disclaimer"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
                >
                  Disclaimer page
                </a>
                .
              </p>

              <div className="mt-6 flex justify-end">
                <Button variant="primary" size="sm" className="rounded-lg" onClick={() => setStep(1)}>
                  I understand
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white">Add your keys</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Two features run on free keys of your own. Skip either — you can add it later in
                Account → Connections.
              </p>

              <div className="mt-5">
                <KeyField kind="subdl" value={subdl} onChange={setSubdl} />
                <div className="h-px bg-zinc-800 my-5" />
                <KeyField kind="gemini" value={gemini} onChange={setGemini} />
              </div>

              <div className="mt-6 flex justify-between gap-3">
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-lg"
                  onClick={finish}
                  disabled={save.isPending}
                >
                  {save.isPending ? 'Saving…' : hasKeys ? 'Save & continue' : 'Skip for now'}
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
