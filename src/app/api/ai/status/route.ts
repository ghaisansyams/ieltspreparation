import { getAiProvider } from "@/lib/ai";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = getAiProvider();
  return json({
    configured: !!provider,
    provider: provider?.name ?? null,
    model: provider?.model ?? null,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    accessTokenRequired: !!process.env.APP_ACCESS_TOKEN?.trim(),
  });
}
