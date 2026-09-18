"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FREQUENCIES, IELTS_SKILLS, type AiField, type VocabDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AiMark } from "./bits";
import { CefrSelector } from "./cefr-selector";

export function ChipsInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-[4px] bg-surface-2 py-0.5 pl-2 pr-1 text-xs text-ink">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label={`Remove ${v}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

function Section({ title, ai, children, className }: { title: string; ai?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line pt-5 first:border-t-0 first:pt-0", className)}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {ai ? <AiMark /> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Full vocabulary editor. Fields the AI produced carry an "AI generated"
 * label; editing a field counts as verifying it and removes the label.
 */
export function VocabForm({ value, onChange, dense }: { value: VocabDraft; onChange: (next: VocabDraft) => void; dense?: boolean }) {
  const set = <K extends keyof VocabDraft>(key: K, v: VocabDraft[K], verifies?: AiField) => {
    onChange({ ...value, [key]: v, aiFields: verifies ? value.aiFields.filter((f) => f !== verifies) : value.aiFields });
  };
  const ai = (f: AiField) => value.aiFields.includes(f);

  return (
    <div className="space-y-6">
      <Section title="Word" ai={ai("pronunciation") || ai("partOfSpeech")}>
        <div className={cn("grid gap-3", dense ? "sm:grid-cols-3" : "sm:grid-cols-[1.3fr_1fr_1fr]")}>
          <Field label="Vocabulary" htmlFor="f-word">
            <Input id="f-word" value={value.word} onChange={(e) => set("word", e.target.value)} placeholder="sophisticated" />
          </Field>
          <Field label="Pronunciation" htmlFor="f-pron">
            <Input id="f-pron" value={value.pronunciation} onChange={(e) => set("pronunciation", e.target.value, "pronunciation")} placeholder="/səˈfɪs.tɪ.keɪ.tɪd/" className="ipa !text-ink" />
          </Field>
          <Field label="Part of speech" htmlFor="f-pos">
            <Input id="f-pos" value={value.partOfSpeech} onChange={(e) => set("partOfSpeech", e.target.value, "partOfSpeech")} placeholder="Adjective" list="pos-options" />
            <datalist id="pos-options">
              {["Noun", "Verb", "Adjective", "Adverb", "Verb/Noun", "Noun/Adjective", "Verb/Adj", "Conjunction", "Preposition", "Phrase"].map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>
      </Section>

      <Section title="Meanings (Indonesian)" ai={ai("meanings")}>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["meaning1", "meaning2", "meaning3"] as const).map((k, i) => (
            <Field key={k} label={`Meaning ${i + 1}`}>
              <Input value={value[k]} onChange={(e) => set(k, e.target.value, "meanings")} placeholder={["Canggih", "Rumit", "Berkelas"][i]} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Synonyms" ai={ai("synonyms")}>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["synonym1", "synonym2", "synonym3"] as const).map((k, i) => (
            <Field key={k} label={`Synonym ${i + 1}`}>
              <Input value={value[k]} onChange={(e) => set(k, e.target.value, "synonyms")} placeholder={["Advanced (Maju)", "Complex (Rumit)", "Refined (Berkelas)"][i]} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Examples" ai={ai("examples")}>
        <div className="space-y-4">
          {([1, 2, 3] as const).map((n) => {
            const en = `example${n}` as const;
            const id = `example${n}Translation` as const;
            return (
              <div key={n} className="grid gap-2 sm:grid-cols-[24px_1fr]">
                <span className="hidden pt-7 font-mono text-xs text-ink-3 sm:block">{n}</span>
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label={`Example ${n}`}>
                    <Textarea value={value[en]} onChange={(e) => set(en, e.target.value, "examples")} rows={2} className="min-h-0" placeholder="English sentence" />
                  </Field>
                  <Field label="Indonesian translation">
                    <Textarea value={value[id]} onChange={(e) => set(id, e.target.value, "examples")} rows={2} className="min-h-0" placeholder="Terjemahan" />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Level & difficulty" ai={ai("cefr") || ai("difficulty") || ai("frequency")}>
        <div className="space-y-4">
          <Field label="CEFR level">
            <CefrSelector
              value={value.cefr}
              source={value.cefrSource}
              onChange={(level) => onChange({ ...value, cefr: level, cefrSource: "manual", aiFields: value.aiFields.filter((f) => f !== "cefr") })}
              onAutoDetect={(level) => onChange({ ...value, cefr: level, cefrSource: "estimated" })}
              detectInput={{ word: value.word, partOfSpeech: value.partOfSpeech, meaning: value.meaning1 }}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Difficulty">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("difficulty", d, "difficulty")}
                    className={cn(
                      "h-9 flex-1 rounded-md border font-mono text-xs transition-colors",
                      value.difficulty === d ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2",
                    )}
                    aria-pressed={value.difficulty === d}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Commonness">
              <Select value={value.frequency ?? ""} onChange={(e) => set("frequency", (e.target.value || null) as VocabDraft["frequency"], "frequency")}>
                <option value="">—</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Learning metadata" ai={ai("definition") || ai("wordFamily") || ai("collocations") || ai("commonMistakes") || ai("tags")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="English definition" className="md:col-span-2">
            <Input value={value.definition} onChange={(e) => set("definition", e.target.value, "definition")} placeholder="advanced and complex; showing refined taste" />
          </Field>
          <Field label="Word family">
            <ChipsInput value={value.wordFamily} onChange={(v) => set("wordFamily", v, "wordFamily")} placeholder="sophistication, unsophisticated" />
          </Field>
          <Field label="Collocations">
            <ChipsInput value={value.collocations} onChange={(v) => set("collocations", v, "collocations")} placeholder="highly sophisticated" />
          </Field>
          <Field label="Common mistakes">
            <ChipsInput value={value.commonMistakes} onChange={(v) => set("commonMistakes", v, "commonMistakes")} placeholder="Using it for people's clothes only" />
          </Field>
          <Field label="Tags">
            <ChipsInput value={value.tags} onChange={(v) => set("tags", v, "tags")} placeholder="technology, academic" />
          </Field>
        </div>
      </Section>

      <Section title="IELTS relevance" ai={ai("ieltsRelevance")}>
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <Field label="Relevance">
            <Select
              value={value.ieltsRelevance?.level ?? ""}
              onChange={(e) =>
                set(
                  "ieltsRelevance",
                  e.target.value ? { level: e.target.value as "high" | "medium" | "low", skills: value.ieltsRelevance?.skills ?? [], note: value.ieltsRelevance?.note } : null,
                  "ieltsRelevance",
                )
              }
            >
              <option value="">—</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Skills">
            <div className="flex flex-wrap gap-1.5">
              {IELTS_SKILLS.map((s) => {
                const on = value.ieltsRelevance?.skills.includes(s) ?? false;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!value.ieltsRelevance}
                    onClick={() =>
                      value.ieltsRelevance &&
                      set(
                        "ieltsRelevance",
                        { ...value.ieltsRelevance, skills: on ? value.ieltsRelevance.skills.filter((x) => x !== s) : [...value.ieltsRelevance.skills, s] },
                        "ieltsRelevance",
                      )
                    }
                    className={cn("h-8 rounded-md border px-2.5 text-xs disabled:opacity-40", on ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>
          {value.ieltsRelevance?.note ? <p className="text-xs text-ink-3 md:col-span-2">{value.ieltsRelevance.note}</p> : null}
        </div>
      </Section>

      {value.reviewNotes.length ? (
        <Section title="Notes">
          <ul className="space-y-1.5">
            {value.reviewNotes.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                <Badge tone={n.kind === "incomplete" ? "warn" : "neutral"} className="mt-0.5">
                  {n.kind === "incomplete" ? "Needs review" : "Note"}
                </Badge>
                {n.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
