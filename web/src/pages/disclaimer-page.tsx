import { PageGradient } from '@/components/system/common/gradient';

// The legal half of the two static pages (About is the other): whose video this
// is — not ours — and where your data lives. The old Privacy and Terms pages
// said the same things a third and fourth time, so they were folded in here.
export default function DisclaimerPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      {/* The same slate wash as About — the two static pages are a pair. */}
      <PageGradient className="from-slate-800/40" />

      <div className="relative max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Disclaimer</h1>
        <p className="text-zinc-400 text-base md:text-lg mb-8">Read this before you watch anything.</p>

        <div className="space-y-8 text-zinc-300 leading-relaxed text-sm md:text-base">
          {/* The point of the page — lifted onto a card so it can't be skimmed
              past. Plain surface, no tint: it's a notice, not a promotion. */}
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-white">We hold no rights to the video</h2>
            <p>
              9film hosts, uploads and stores no films, TV shows or media files, and owns no licence
              to any of them. Every poster, description, stream and subtitle you see is fetched at
              request time from publicly accessible third-party sources — IMDb for metadata, an
              upstream stream provider for playback, SubDL for subtitles — and passed straight
              through to your browser.
            </p>
            <p>
              Every trademark, poster and title belongs to its respective owner. Availability,
              quality and accuracy come from those sources, so they are outside our control and can
              change or disappear at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">No affiliation, no warranty</h2>
            <p>
              9film is a personal, non-commercial project, built to explore the technology and to
              support language learning. It is not affiliated with, endorsed by or connected to any
              streaming service, studio or content provider, and it is provided as is, with no
              warranty of any kind. Whether a given title is legal to watch where you are is your
              call to make, not ours.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Your data stays with you</h2>
            <p>
              There is no sign-in and no 9film server. Your list, watch progress, playback settings
              and saved vocabulary live in a SQLite file on your own machine, alongside any API keys
              you enter under Profile → Connections. Nothing is sent anywhere else — so treat it as
              a local tool, and don't keep anything sensitive in it.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Rights holders</h2>
            <p>
              Because nothing is stored here, there is nothing here to take down. A file you want
              removed lives with whoever hosts it, and a request has to reach them to have any
              effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
