import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { AiNotConfiguredError, AiOutputError } from "@/lib/ai";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AiNotConfiguredError) {
    return json({ error: error.message, code: "ai_not_configured" }, 503);
  }
  if (error instanceof AiOutputError) {
    return json({ error: error.message, code: "ai_output" }, 502);
  }
  console.error("[api]", error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json({ error: message, code: "internal" }, 500);
}

/**
 * Protects AI routes (they spend the owner's API credit).
 * - Supabase configured → a valid signed-in session is required.
 * - Else APP_ACCESS_TOKEN set → the x-app-token header must match.
 * - Else (local personal use) → open.
 */
export async function guard(req: Request): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in (Settings → Cloud sync) to use AI features.", code: "unauthorized" }, 401);
    const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json({ error: "Your session expired. Sign in again.", code: "unauthorized" }, 401);
    return null;
  }
  const appToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (appToken && req.headers.get("x-app-token") !== appToken) {
    return json({ error: "Enter the app access token in Settings → AI access.", code: "unauthorized" }, 401);
  }
  return null;
}

export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: json({ error: "Invalid JSON body", code: "bad_request" }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { response: json({ error: "Invalid request", code: "bad_request", issues: parsed.error.issues.slice(0, 5) }, 400) };
  }
  return { data: parsed.data };
}
