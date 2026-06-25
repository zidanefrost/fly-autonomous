import { useEffect, useRef, useState } from "react";
import type { AirportWithStatus } from "../lib/types";
import { AI_BRIEFING_STATUS_URL, AI_BRIEFING_URL, WORKER_CONFIGURED } from "../lib/workerUrls";

export type BriefingStage = "idle" | "creating" | "waiting" | "done";

export const STAGE_LABEL: Record<BriefingStage, string> = {
  idle: "",
  creating: "Sending live risk data to Manus…",
  waiting: "Manus is analyzing current conditions and drafting the answer…",
  done: "",
};

function airportsForPrompt(airports: AirportWithStatus[], fullContext: boolean) {
  const withRisk = airports.filter((a) => a.risk);
  const sorted = [...withRisk].sort((a, b) => (b.risk!.score ?? 0) - (a.risk!.score ?? 0));
  // A specific free-text question needs the full picture (it might ask about a
  // region with no airport in the global top 5); the default briefing stays
  // short and only looks at the worst few.
  const slice = fullContext ? sorted : sorted.slice(0, 5);
  return slice.map((a) => ({
    icao: a.icao,
    name: a.name,
    city: a.city,
    country: a.country,
    level: a.risk!.level,
    score: a.risk!.score,
    factors: a.risk!.factors,
  }));
}

function localSummary(top: ReturnType<typeof airportsForPrompt>): string {
  if (top.length === 0 || top[0].score === 0) {
    return "All monitored airports are currently reporting low weather-driven delay risk. No elevated-risk action needed.";
  }
  const worst = top.filter((a) => a.score >= 20).slice(0, 5);
  const lines = worst.map(
    (a) => `${a.icao} (${a.city}) — ${a.level} risk, ${a.score}/100: ${a.factors.join("; ")}.`
  );
  return [
    `${worst.length} airport(s) currently show elevated weather-driven delay risk:`,
    ...lines,
    "Recommendation: prioritize attention on the highest-scoring airports above for inbound/outbound schedule buffering.",
  ].join("\n");
}

export function useAiBriefing(airports: AirportWithStatus[]) {
  const [stage, setStage] = useState<BriefingStage>("idle");
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

  async function ask(question?: string) {
    const trimmed = question?.trim();
    setStage("creating");
    setText(null);
    const top = airportsForPrompt(airports, Boolean(trimmed));

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
        body: JSON.stringify({ airports: top, question: trimmed || undefined }),
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
              .reverse() // API returns newest-first; answer should read chronologically
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
      setText(
        "Manus is taking longer than expected — showing a local summary instead.\n\n" +
          localSummary(top)
      );
      setUsedManus(false);
    } catch {
      setUsedManus(false);
      setText(localSummary(top));
    } finally {
      setStage("done");
    }
  }

  function reset() {
    setStage("idle");
    setText(null);
  }

  return { stage, loading, elapsed, text, usedManus, ask, reset };
}
