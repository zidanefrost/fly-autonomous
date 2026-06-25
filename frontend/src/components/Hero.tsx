import { useState } from "react";
import type { FormEvent } from "react";
import type { AirportWithStatus } from "../lib/types";
import { STAGE_LABEL, useAiBriefing } from "../hooks/useAiBriefing";

const EXAMPLES = [
  "Which airports are at risk right now?",
  "What's happening in Asia?",
  "Any thunderstorms affecting Europe?",
];

export function Hero({ airports }: { airports: AirportWithStatus[] }) {
  const [question, setQuestion] = useState("");
  const { stage, loading, elapsed, text, usedManus, ask, reset } = useAiBriefing(airports);

  const reporting = airports.filter((a) => a.risk).length;
  const severe = airports.filter((a) => a.risk?.level === "SEVERE").length;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  function askExample(example: string) {
    setQuestion(example);
    ask(example);
  }

  function askAgain() {
    reset();
    setQuestion("");
  }

  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Live · {reporting} airports reporting · {severe} severe right now · zero human input
      </div>

      <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
        An agent that watches the sky, so you don't have to.
      </h1>
      <p className="mt-4 max-w-xl text-slate-400">
        Ask one question — or just hit enter — and get a live, explainable delay-risk
        briefing for 102 airports worldwide, generated from real weather data.
      </p>

      {stage === "idle" && (
        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-xl">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl focus-within:border-sky-500/40">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which airports are at risk right now?"
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Ask →
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => askExample(example)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500 hover:border-white/30 hover:text-slate-300"
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      )}

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500/20 border-t-sky-400" />
          <div className="text-sm text-slate-400">{STAGE_LABEL[stage]}</div>
          <div className="font-mono text-xs text-slate-600">{elapsed}s elapsed</div>
        </div>
      )}

      {!loading && text && (
        <div className="mt-10 w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-2xl">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>{usedManus ? "Manus AI" : "Local summary"}</span>
            <button type="button" onClick={askAgain} className="hover:text-slate-200">
              Ask another ✕
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{text}</p>
        </div>
      )}

      <a
        href="#dashboard"
        className="mt-14 text-xs uppercase tracking-widest text-slate-500 transition hover:text-slate-300"
      >
        View live operations data ↓
      </a>
    </section>
  );
}
