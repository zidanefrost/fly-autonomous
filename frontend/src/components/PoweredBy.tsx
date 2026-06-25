const SOURCES = ["aviationweather.gov", "Supabase", "Modal", "Manus AI"];

export function PoweredBy() {
  return (
    <section className="border-t border-white/10 px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
        <span className="text-xs uppercase tracking-widest text-slate-600">Powered by</span>
        {SOURCES.map((s) => (
          <span key={s} className="text-sm text-slate-400">
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}
