import type { ReactNode } from 'react';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">{title}</h1>
        <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base">
          {children}
        </div>
      </div>
    </div>
  );
}
