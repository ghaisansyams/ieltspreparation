"use client";

import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Evaluation } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

const CRITERIA: { key: keyof Pick<Evaluation, "grammar" | "vocabularyUsage" | "naturalness" | "context" | "cefrAppropriateness">; label: string }[] = [
  { key: "grammar", label: "Grammar" },
  { key: "vocabularyUsage", label: "Vocabulary usage" },
  { key: "naturalness", label: "Naturalness" },
  { key: "context", label: "Context" },
  { key: "cefrAppropriateness", label: "CEFR appropriateness" },
];

/** AI feedback on a learner's sentence. Suggestions only — the learner's sentence is never replaced. */
export function EvaluationView({ evaluation, sentence }: { evaluation: Evaluation; sentence: string }) {
  return (
    <div className="space-y-4 animate-rise">
      <div className="rounded-[10px] border border-line bg-surface-2/50 p-4">
        <div className="eyebrow mb-1">Your sentence</div>
        <p className="text-[15px] text-ink">{sentence}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={evaluation.targetWordUsedCorrectly ? "good" : "bad"}>
            {evaluation.targetWordUsedCorrectly ? "Target word used correctly" : evaluation.usesTargetWord ? "Target word misused" : "Target word missing"}
          </Badge>
          <Badge tone="neutral" title="Band scores apply to a full Task 1 or Task 2 response, not a single sentence">
            Sentence practice · not a band score
          </Badge>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CRITERIA.map(({ key, label }) => {
          const c = evaluation[key];
          const score = Math.max(1, Math.min(5, Math.round(c.score)));
          return (
            <div key={key} className="rounded-[10px] border border-line bg-surface p-3">
              <div className="eyebrow">{label}</div>
              <div className="mt-1.5 flex items-center gap-1" aria-label={`${score} out of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= score ? (score >= 4 ? "bg-good" : score === 3 ? "bg-accent" : "bg-warn") : "bg-surface-3")} />
                ))}
                <span className="ml-1.5 font-mono text-xs font-medium text-ink">{score}</span>
              </div>
              <p className="mt-2 text-xs leading-snug text-ink-2">{c.comment}</p>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-ink-2">{evaluation.overall}</p>

      {evaluation.suggestions.length ? (
        <div>
          <div className="eyebrow mb-2">Suggestions</div>
          <ul className="space-y-2">
            {evaluation.suggestions.map((s, i) => (
              <li key={i} className="rounded-[10px] border border-line bg-surface p-3 text-sm">
                <div className="text-ink-3">{s.issue}</div>
                <div className="mt-1 font-medium text-ink">→ {s.suggestion}</div>
                <div className="mt-1 text-xs text-ink-2">{s.why}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.improvedVersion ? (
        <div className="flex gap-3 rounded-[10px] border border-accent/30 bg-accent-soft p-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <div>
            <div className="eyebrow mb-0.5 text-accent-ink">One possible version (optional)</div>
            <p className="text-sm text-ink">{evaluation.improvedVersion}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
