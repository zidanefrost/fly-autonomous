const FEATURES = [
  {
    icon: "🗺️",
    title: "Live world map",
    body: "102 airports plotted by real coordinates, color-coded by risk, with pulsing markers for HIGH/SEVERE.",
  },
  {
    icon: "🧮",
    title: "Explainable risk engine",
    body: "Deterministic and rule-based — every score lists the exact factors behind it. No black box.",
  },
  {
    icon: "⚡",
    title: "Realtime sync",
    body: "Supabase Realtime pushes updates straight to the dashboard the instant the worker writes new data.",
  },
  {
    icon: "✦",
    title: "One-prompt AI briefing",
    body: "Ask any question about current conditions and Manus AI answers it from the live dataset in seconds.",
  },
  {
    icon: "🔔",
    title: "Proactive alerts",
    body: "In-dashboard toasts and native browser notifications fire automatically on risk escalation.",
  },
  {
    icon: "🤖",
    title: "Fully autonomous worker",
    body: "A Modal cron job runs the entire observe-score-write cycle every 10 minutes, unattended.",
  },
];

export function Features() {
  return (
    <section className="border-t border-white/10 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-slate-50 sm:text-3xl">
          Everything running underneath one prompt
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-3 font-semibold text-slate-100">{f.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
