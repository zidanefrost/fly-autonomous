export function FinalCta() {
  return (
    <section className="border-t border-white/10 px-6 py-20 text-center">
      <h2 className="text-2xl font-bold text-slate-50 sm:text-3xl">
        Stop watching the weather yourself.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-slate-400">
        One question gets you the answer. Everything else runs on its own.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#top"
          className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
        >
          ↑ Ask the agent
        </a>
        <a
          href="#dashboard"
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
        >
          ↓ View live operations
        </a>
      </div>
    </section>
  );
}
