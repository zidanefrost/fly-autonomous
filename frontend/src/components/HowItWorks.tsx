const STEPS = [
  {
    n: "01",
    title: "Watch Agent observes",
    body: "Every 10 minutes, an autonomous Modal worker fetches live METAR weather observations for all 102 airports directly from aviationweather.gov — no human triggers it.",
  },
  {
    n: "02",
    title: "Risk engine scores",
    body: "A deterministic rule engine scores each airport 0–100 for weather-driven delay risk, using the same VFR/MVFR/IFR/LIFR categories and thunderstorm/wind/fog factors real airline ops teams use.",
  },
  {
    n: "03",
    title: "Every score is explained",
    body: "Nothing is a black box — each score ships with the specific contributing factors and the raw METAR it came from, stored and auditable in Supabase.",
  },
  {
    n: "04",
    title: "Alerts fire on escalation",
    body: "The moment an airport crosses into HIGH or SEVERE, a live in-dashboard alert and browser notification fire automatically — nobody has to be staring at the screen.",
  },
  {
    n: "05",
    title: "Briefing Agent answers",
    body: "Ask a question in plain English at the top of this page and Manus AI reads the live data and writes a duty-manager-ready answer in seconds.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-white/10 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-slate-50 sm:text-3xl">
          From live weather to an explained answer
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
          Five autonomous stages run continuously, with no human in the loop until a
          decision needs to be made.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step) => (
            <div key={step.n}>
              <div className="font-mono text-sm text-sky-400">{step.n}</div>
              <div className="mt-2 font-semibold text-slate-100">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
