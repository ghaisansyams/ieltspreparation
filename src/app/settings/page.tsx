"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Cloud, CloudOff, Download, KeyRound, LogOut, RefreshCw, Sparkles, Trash2, Upload, Volume2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented, Spinner } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { useSpeech } from "@/hooks/use-speech";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { aiJson, fetchAiStatus, type AiStatus } from "@/lib/ai/client";
import { snapshotOf, useAppStore, type Snapshot } from "@/lib/store/app-store";
import { mergeSnapshots } from "@/lib/sync/merge";
import { getSupabase } from "@/lib/sync/supabase-client";
import { syncNow, useSyncStore } from "@/lib/sync/sync-engine";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel className="grid gap-5 p-5 md:grid-cols-[240px_1fr] md:p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </Panel>
  );
}

/** Backup file marker. The old id is still accepted so earlier exports import fine. */
const APP_ID = "lexiband";
const KNOWN_APP_IDS = [APP_ID, "lexis-vocab-hub"];

export default function SettingsPage() {
  const profile = useAppStore((s) => s.profile);
  const { setDisplayName, updateSettings, resetProgress, clearEverything, replaceSnapshot } = useAppStore.getState();
  const { preference, setTheme } = useTheme();
  const { speak } = useSpeech();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAiStatus(true).then(setStatus);
  }, []);

  const testAi = async () => {
    setTesting(true);
    try {
      const res = await aiJson<{ source: string; items: { cefr: string }[] }>("/api/ai/cefr", { words: [{ word: "distinct" }] });
      toast.success(res.source === "ai" ? "AI is working" : "Server reachable — using offline heuristic", { description: `“distinct” → ${res.items[0]?.cefr}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI test failed");
    } finally {
      setTesting(false);
    }
  };

  const exportBackup = () => {
    const data = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), ...snapshotOf(useAppStore.getState()) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexiband-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<Snapshot> & { app?: string };
      if (!data.app || !KNOWN_APP_IDS.includes(data.app) || !data.vocab || !data.profile) throw new Error("Not a Lexiband backup file");
      const merged = mergeSnapshots(snapshotOf(useAppStore.getState()), { vocab: data.vocab, progress: data.progress ?? {}, attempts: data.attempts ?? [], profile: data.profile });
      replaceSnapshot(merged);
      toast.success("Backup restored", { description: `${Object.keys(data.vocab).length} words merged into your library.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read backup");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Settings" title="Settings" />

      <Section title="Profile" description="Used in your greeting.">
        <Field label="Display name" htmlFor="name">
          <Input id="name" value={profile.displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 40))} placeholder="Your name" className="max-w-sm" />
        </Field>
      </Section>

      <Section title="Appearance & audio">
        <Field label="Theme">
          <Segmented<ThemePreference>
            value={preference}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Field>
        <Field label="Pronunciation voice">
          <div className="flex items-center gap-2">
            <Select value={profile.settings.voice} onChange={(e) => updateSettings({ voice: e.target.value as "en-US" | "en-GB" })} className="max-w-48">
              <option value="en-US">American English</option>
              <option value="en-GB">British English</option>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => speak("The twins have distinct personalities.")}>
              <Volume2 /> Test
            </Button>
          </div>
        </Field>
      </Section>

      <Section title="Learning" description="Shapes today's review queue and mission.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily review goal" hint="Reviews per day for your mission.">
            <Input type="number" min={5} max={200} value={profile.settings.dailyReviewGoal} onChange={(e) => updateSettings({ dailyReviewGoal: Math.max(5, Math.min(200, Number(e.target.value) || 20)) })} />
          </Field>
          <Field label="New words per day" hint="Unstarted words introduced each day.">
            <Input type="number" min={0} max={50} value={profile.settings.newWordsPerDay} onChange={(e) => updateSettings({ newWordsPerDay: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          </Field>
        </div>
      </Section>

      <Section title="AI provider" description="Configured on the server through environment variables — keys never reach the browser.">
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface-2/40 px-4 py-3">
          {status === null ? (
            <Spinner />
          ) : status.configured ? (
            <CheckCircle2 className="size-5 text-good" />
          ) : (
            <XCircle className="size-5 text-ink-3" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{status?.configured ? `Connected · ${status.provider}` : "Not configured"}</div>
            <div className="truncate font-mono text-xs text-ink-3">{status?.configured ? status.model : "Set ANTHROPIC_API_KEY (or OPENAI_COMPATIBLE_*) in .env.local"}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={testAi} disabled={testing}>
            {testing ? <Spinner /> : <Sparkles />} Test
          </Button>
        </div>
        <p className="text-xs text-ink-3">Without AI: games, reviews, search, graph, CSV/Excel/TXT import and your PDF all still work. Generate Vocabulary falls back to a public dictionary.</p>
        {status?.accessTokenRequired ? (
          <Field label="App access token" hint="The server requires this token for AI features (APP_ACCESS_TOKEN). Stored only in this browser.">
            <div className="relative max-w-sm">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input type="password" value={profile.settings.accessToken} onChange={(e) => updateSettings({ accessToken: e.target.value })} className="pl-9" autoComplete="off" />
            </div>
          </Field>
        ) : null}
      </Section>

      <CloudSync supabaseConfigured={!!status?.supabase} />

      <Section title="Data" description="Everything lives in this browser (IndexedDB) unless cloud sync is on.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download /> Export backup (JSON)
          </Button>
          <Button variant="secondary" onClick={() => backupInput.current?.click()}>
            <Upload /> Restore backup
          </Button>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBackup(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setConfirm("reset")}>
            <RefreshCw /> Reset learning progress
          </Button>
          <Button variant="danger" onClick={() => setConfirm("delete")}>
            <Trash2 /> Delete all vocabulary
          </Button>
        </div>
      </Section>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent
          title={confirm === "reset" ? "Reset learning progress?" : "Delete all vocabulary?"}
          description={
            confirm === "reset"
              ? "Keeps every word but clears reviews, answers, XP, streaks and achievements. Export a backup first if you might want it back."
              : "Removes every word, its progress and history from this browser (and the cloud, if synced). Export a backup first."
          }
        >
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === "reset") resetProgress();
                else clearEverything();
                toast(confirm === "reset" ? "Progress reset" : "Library cleared");
                setConfirm(null);
              }}
            >
              {confirm === "reset" ? "Reset progress" : "Delete everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CloudSync({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const sync = useSyncStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = getSupabase();

  if (!supabaseConfigured || !supabase) {
    return (
      <Section title="Cloud sync" description="Optional. Keep your library on Supabase and use it across devices.">
        <div className="flex items-start gap-3 rounded-[10px] border border-line bg-surface-2/40 px-4 py-3">
          <CloudOff className="mt-0.5 size-5 text-ink-3" />
          <div className="text-sm text-ink-2">
            Not configured. Create a Supabase project, run <span className="font-mono text-xs">supabase/migrations/0001_init.sql</span>, then set <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</span> and <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>.
          </div>
        </div>
      </Section>
    );
  }

  const signIn = async (mode: "password" | "signup" | "magic") => {
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/settings" } });
        if (error) throw error;
        toast.success("Check your email for the sign-in link");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created", { description: "Confirm your email if your project requires it." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Cloud sync" description="Local-first: this browser keeps working offline, changes sync when signed in.">
      {sync.email ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface-2/40 px-4 py-3">
            <Cloud className="size-5 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{sync.email}</div>
              <div className="text-xs text-ink-3">
                {sync.status === "syncing" ? "Syncing…" : sync.status === "error" ? `Error: ${sync.error}` : sync.lastSyncedAt ? `Synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : "Connected"}
              </div>
            </div>
            <Badge tone={sync.status === "error" ? "bad" : sync.status === "syncing" ? "accent" : "good"}>{sync.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void syncNow()} disabled={sync.status === "syncing"}>
              <RefreshCw /> Sync now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void supabase.auth.signOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="grid max-w-md gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void signIn("password");
          }}
        >
          <Field label="Email" htmlFor="sync-email">
            <Input id="sync-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="sync-password">
            <Input id="sync-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy || !email || !password}>
              {busy ? <Spinner className="text-bg" /> : null} Sign in
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={busy || !email || password.length < 6} onClick={() => void signIn("signup")}>
              Create account
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy || !email} onClick={() => void signIn("magic")}>
              Email me a link
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
