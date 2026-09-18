import type { Snapshot } from "@/lib/store/app-store";
import type { DayActivity, Profile } from "@/lib/types";

const newer = (a?: string, b?: string) => (a ?? "") >= (b ?? "");

/** Last-writer-wins per entry; learning history (attempts, activity, achievements) is unioned. */
export function mergeSnapshots(local: Snapshot, remote: Omit<Snapshot, "tombstones">): Snapshot {
  const tomb = new Set(local.tombstones);

  const vocab = { ...local.vocab };
  for (const [id, r] of Object.entries(remote.vocab)) {
    if (tomb.has(id)) continue;
    if (!vocab[id] || newer(r.updatedAt, vocab[id].updatedAt)) vocab[id] = r;
  }
  const progress = { ...local.progress };
  for (const [id, r] of Object.entries(remote.progress)) {
    if (!vocab[id]) continue;
    if (!progress[id] || newer(r.updatedAt, progress[id].updatedAt)) progress[id] = r;
  }

  const attemptIds = new Set(local.attempts.map((a) => a.id));
  const attempts = [...local.attempts, ...remote.attempts.filter((a) => !attemptIds.has(a.id) && vocab[a.vocabularyId])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return { vocab, progress, attempts, profile: mergeProfiles(local.profile, remote.profile), tombstones: local.tombstones };
}

export function mergeProfiles(local: Profile, remote: Profile): Profile {
  const base = newer(remote.updatedAt, local.updatedAt) ? remote : local;
  const activity: Profile["activity"] = { ...remote.activity };
  for (const [day, a] of Object.entries(local.activity)) {
    const r = activity[day];
    activity[day] = r
      ? (Object.fromEntries(Object.keys(a).map((k) => [k, Math.max(a[k as keyof DayActivity], r[k as keyof DayActivity])])) as unknown as DayActivity)
      : a;
  }
  return {
    ...base,
    xp: Math.max(local.xp, remote.xp),
    achievements: { ...remote.achievements, ...local.achievements },
    dailyChallenges: { ...remote.dailyChallenges, ...local.dailyChallenges },
    activity,
    // The access token is device-local and never leaves the browser.
    settings: { ...base.settings, accessToken: local.settings.accessToken },
  };
}
