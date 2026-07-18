export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Disclaimer</h1>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base">
          <p>
            9film does not host, upload, or store any films, TV shows, or media files on its own
            servers. All metadata, streams, and subtitles are retrieved from publicly accessible
            third-party sources.
          </p>
          <p>
            This project exists solely to demonstrate web and streaming technologies. It is not
            intended for commercial use or for distributing copyrighted material.
          </p>
          <p>
            Any trademarks, posters, and titles referenced belong to their respective owners.
          </p>
        </div>
      </div>
    </div>
  );
}
