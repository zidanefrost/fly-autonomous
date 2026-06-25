import { useEffect, useRef, useState } from "react";
import type { AirportWithStatus } from "../lib/types";
import { AI_BRIEFING_STATUS_URL, AI_BRIEFING_URL, WORKER_CONFIGURED } from "../lib/workerUrls";

type Stage = "idle" | "creating" | "waiting" | "done";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  creating: "Sending live risk data to Manus…",
  waiting: "Manus is analyzing current conditions and drafting the briefing…",
  done: "",
};

function topRiskAirports(airports: AirportWithStatus[], n = 5) {
  return airports
    .filter((a) => a.risk)
    .sort((a, b) => (b.risk!.score ?? 0) - (a.risk!.score ?? 0))
    .slice(0, n)
    .map((a) => ({
      icao: a.icao,
      name: a.name,
      city: a.city,
      country: a.country,
      level: a.risk!.level,
      score: a.risk!.score,
      factors: a.risk!.factors,
    }));
}

function localSummary(top: ReturnType<typeof topRiskAirports>): string {
  if (top.length === 0 || top[0].score === 0) {
    return "All monitored airports are currently reporting low weather-driven delay risk. No elevated-risk action needed.";
  }
  const worst = top.filter((a) => a.score >= 20);
  const lines = worst.map(
    (a) => `${a.icao} (${a.city}) — ${a.level} risk, ${a.score}/100: ${a.factors.join("; ")}.`
  );
  return [
    `${worst.length} airport(s) currently show elevated weather-driven delay risk:`,
    ...lines,
    "Recommendation: prioritize attention on the highest-scoring airports above for inbound/outbound schedule buffering.",
  ].join("\n");
}

export function AiBriefingButton({ airports }: { airports: AirportWithStatus[] }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState<string | null>(null);
  const [usedManus, setUsedManus] = useState(false);
  const loading = stage === "creating" || stage === "waiting";
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  async function generate() {
    setOpen(true);
    setStage("creating");
    setText(null);
    const top = topRiskAirports(airports);

    if (!WORKER_CONFIGURED) {
      setUsedManus(false);
      setText(localSummary(top));
      setStage("done");
      return;
    }

    try {
      const createResp = await fetch(AI_BRIEFING_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top_risk_airports: top }),
      });
      const created = await createResp.json();
      if (created.error || !created.task_id) {
        setUsedManus(false);
        setText(localSummary(top));
        setStage("done");
        return;
      }

      setUsedManus(true);
      setStage("waiting");
      const taskId = created.task_id as string;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusResp = await fetch(
          `${AI_BRIEFING_STATUS_URL}?task_id=${encodeURIComponent(taskId)}`
        );
        const statusData = await statusResp.json();
        if (statusData.status === "stopped") {
          type ManusMessage = { type: string; assistant_message?: { content?: string } };
          const messages = (statusData.messages ?? []) as ManusMessage[];
          const content =
            messages
              .filter((m) => m.type === "assistant_message")
              .reverse() // API returns newest-first; briefing reads chronologically
              .map((m) => m.assistant_message?.content)
              .filter(Boolean)
              .join("\n\n") || "(Manus task finished with no message content)";
          setText(content);
          setStage("done");
          return;
        }
        if (statusData.status === "error") {
          setUsedManus(false);
          setText(localSummary(top));
          setStage("done");
          return;
        }
      }
      setText("Manus briefing is taking longer than expected — showing local summary instead.\n\n" + localSummary(top));
      setUsedManus(false);
    } catch {
      setUsedManus(false);
      setText(localSummary(top));
    } finally {
      setStage("done");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
      >
        ✦ AI Ops Briefing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#0b0e16] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                {loading
                  ? "Generating Ops Briefing…"
                  : usedManus
                    ? "AI Ops Briefing (Manus)"
                    : "Ops Briefing (local summary)"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500/20 border-t-sky-400" />
                <div className="text-sm text-slate-300">{STAGE_LABEL[stage]}</div>
                <div className="font-mono text-xs text-slate-500">{elapsed}s elapsed</div>
                <div className="text-xs text-slate-600">
                  Real AI generation typically takes 15–30s. We'll fall back to a local
                  summary automatically if it takes too long.
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-slate-200">{text}</pre>
            )}
            {!WORKER_CONFIGURED && !loading && (
              <div className="mt-3 text-xs text-slate-500">
                Set VITE_WORKER_BASE_URL (and configure MANUS_API_KEY on the worker) for an
                AI-generated briefing via Manus.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
