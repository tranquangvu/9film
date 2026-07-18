export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base">
          <p>
            9film stores only the data needed to power your account: your email, a hashed password, and
            your personal lists, watch progress, and playback settings. Passwords are never stored in
            plain text.
          </p>
          <p>
            Your authentication token is kept in your browser's local storage to keep you signed in.
            We do not sell your data or share it with third parties for advertising.
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
