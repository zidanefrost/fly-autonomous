const GUIDE_STEPS = [
  {
    n: "1",
    title: "Ask, or just hit enter",
    body: "Type a real question at the top of this page — or leave it blank and press Ask — to get an instant AI briefing on current conditions.",
  },
  {
    n: "2",
    title: "Scroll to the live map",
    body: "Each pin is an airport, color-coded by risk level. Click any pin to open its full detail panel.",
  },
  {
    n: "3",
    title: "Sort and filter the table",
    body: "Search by ICAO code, city, or country, and sort by delay risk to find what needs attention first.",
  },
  {
    n: "4",
    title: "Turn on alerts once",
    body: "Click \"Enable alerts\" and you'll get a live notification the moment any airport escalates — no need to keep watching the tab.",
  },
  {
    n: "5",
    title: "Force a refresh anytime",
    body: "Hit \"Refresh\" to pull the latest weather immediately instead of waiting for the next 10-minute autonomous cycle.",
  },
];

export function UsageGuide() {
  return (
    <section className="border-t border-white/10 bg-white/[0.02] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-bold text-slate-50 sm:text-3xl">
          How to use it
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
          No training needed — everything below is the entire operating manual.
        </p>

        <ol className="mt-12 space-y-6">
          {GUIDE_STEPS.map((step) => (
            <li key={step.n} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 font-mono text-sm text-sky-400">
                {step.n}
              </div>
              <div>
                <div className="font-semibold text-slate-100">{step.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
