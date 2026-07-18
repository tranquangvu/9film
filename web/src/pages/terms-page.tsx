export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Terms of Service</h1>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base">
          <p>
            9film is provided "as is" for educational and demonstration purposes, without warranties of
            any kind. By using it you agree that the service may change or be unavailable at any time.
          </p>
          <p>
            You are responsible for keeping your account credentials secure and for any activity under
            your account. Do not use the service for unlawful purposes.
          </p>
          <p>
            9film does not host any video content. Streams and metadata are resolved from third-party
            providers, and availability is outside our control.
          </p>
        </div>
      </div>
    </div>
  );
}
