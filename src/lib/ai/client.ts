"use client";

import { useAppStore } from "@/lib/store/app-store";
import { getSupabase } from "@/lib/sync/supabase-client";

// Browser-side helper for calling /api/ai/*. Attaches whichever credential the
// server expects (Supabase session or app access token) and normalises errors.

export class AiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const token = useAppStore.getState().profile.settings.accessToken;
  if (token) headers["x-app-token"] = token;
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function toError(res: Response): Promise<AiRequestError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return new AiRequestError(body.error ?? `Request failed (${res.status})`, body.code ?? "internal", res.status);
}

export async function aiJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export async function aiForm<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: await authHeaders(), body: form, signal });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export async function aiStream(path: string, body: unknown, onText: (full: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  return full;
}

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  supabase: boolean;
  accessTokenRequired: boolean;
}

let statusPromise: Promise<AiStatus> | null = null;
export function fetchAiStatus(force = false): Promise<AiStatus> {
  if (!statusPromise || force) {
    statusPromise = fetch("/api/ai/status")
      .then((r) => r.json() as Promise<AiStatus>)
      .catch(() => ({ configured: false, provider: null, model: null, supabase: false, accessTokenRequired: false }));
  }
  return statusPromise;
}
