export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base">
          <p>
            9film runs locally and has no accounts to sign in to. Your lists, watch progress,
            playback settings and vocabulary live in a SQLite file on your own machine, alongside any
            API keys you enter under Profile → Connections. Nothing is sent to a 9film server,
            because there isn't one.
          </p>
          <p>
            Title metadata, streams, and subtitles are fetched from third-party sources at request
            time. This is a demonstration project; do not store sensitive personal information in it.
          </p>
        </div>
      </div>
    </div>
  );
}
