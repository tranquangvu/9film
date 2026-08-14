import { Link } from 'react-router-dom';
import { PageGradient } from '@/components/system/common/gradient';

// The legal half of the two static pages (About is the other): whose video this
// is — not ours — and where your data lives. The old Privacy and Terms pages
// said the same things a third and fourth time, so they were folded in here.
export default function DisclaimerPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      {/* The same slate wash as About — the two static pages are a pair, and a
          cool background leaves the orange to the one card that matters. */}
      <PageGradient className="from-slate-800/40" />

      <div className="relative max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Disclaimer</h1>

        <div className="space-y-8 text-zinc-300 leading-relaxed text-sm md:text-base">
          <section className="space-y-4">
            <p>
              9film is a personal tool for learning English from films and series — what it does and
              how to use it is on the{' '}
              <Link to="/about" className="text-orange-400 hover:text-orange-300 transition-colors">
                about
              </Link>{' '}
              page. This page is the part you should read before watching anything.
            </p>
          </section>

          {/* The point of the page — lifted onto a card so it can't be skimmed past. */}
          <section
            className="space-y-4 rounded-2xl border border-orange-500/15 p-6 md:p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(17,17,17,0.95) 60%)',
            }}
          >
            <h2 className="text-xl md:text-2xl font-bold text-white">We hold no rights to the video</h2>
            <p>
              9film hosts, uploads and stores no films, TV shows or media files. It owns no licence
              to any of them. Every poster, description, stream and subtitle you see is fetched at
              request time from publicly accessible third-party sources — IMDb for metadata, an
              upstream stream provider for playback, SubDL for subtitles — and simply passed through
              to your browser.
            </p>
            <p>
              That means availability, quality and accuracy are outside our control, and every
              trademark, poster and title belongs to its respective owner. The project exists to
              demonstrate the technology and to support language learning; it is not for commercial
              use or for distributing copyrighted material. It is provided as is, with no warranty.
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
        </div>
      </div>
    </div>
  );
}
