import { extractText, getDocumentProxy } from "unpdf";
import { AiNotConfiguredError, getAiProvider } from "@/lib/ai";
import { EXTRACT_SYSTEM } from "@/lib/ai/prompts";
import { ExtractionSchema, type ExtractedEntry } from "@/lib/ai/schemas";
import { extractedToDraft } from "@/lib/ai/to-draft";
import { chunkPdfText, isKnownSourceDocument } from "@/lib/import/pdf-chunks";
import { errorResponse, guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHUNKS = 40;
const CONCURRENCY = 3;

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return json({ error: "Upload a PDF file.", code: "bad_request" }, 400);
  }
  if (!file) return json({ error: "Upload a PDF file.", code: "bad_request" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "PDF is larger than 15 MB.", code: "too_large" }, 413);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      return json({ error: "That file is not a PDF.", code: "bad_request" }, 400);
    }
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const joined = pages.join("\n");

    // The learner's own vocabulary PDF is already transcribed row by row — no AI needed.
    if (isKnownSourceDocument(joined)) {
      return json({ matchedSource: true, pages: totalPages });
    }
    if (!joined.trim()) {
      return json({ error: "No selectable text found. Scanned PDFs aren't supported yet — export the original as CSV/XLSX.", code: "no_text" }, 422);
    }

    const provider = getAiProvider();
    if (!provider) throw new AiNotConfiguredError("PDF import needs an AI provider. Without one, export your sheet as CSV or Excel — its headers are recognised offline.");

    const chunks = chunkPdfText(pages);
    if (chunks.length > MAX_CHUNKS) {
      return json({ error: `This PDF is too long for one import (${chunks.length} parts). Split it into smaller files.`, code: "too_large" }, 413);
    }

    const results: ExtractedEntry[][] = new Array(chunks.length);
    const warnings: string[] = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
        while (next < chunks.length) {
          const i = next++;
          try {
            const out = await provider.generateObject({
              system: EXTRACT_SYSTEM,
              prompt: `Document text (part ${i + 1} of ${chunks.length}):\n"""\n${chunks[i]}\n"""`,
              schema: ExtractionSchema,
              schemaName: "vocabulary extraction",
              maxTokens: 16000,
              effort: "low",
            });
            results[i] = out.entries;
          } catch (error) {
            results[i] = [];
            warnings.push(`Part ${i + 1} could not be read: ${error instanceof Error ? error.message : "unknown error"}`);
          }
        }
      }),
    );

    // Chunks overlap only at row boundaries; drop exact duplicates by number+word.
    const seen = new Set<string>();
    const drafts = results
      .flat()
      .filter((e) => e.word.trim())
      .filter((e) => {
        const key = `${e.number ?? ""}|${e.word.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(extractedToDraft);

    return json({ matchedSource: false, pages: totalPages, drafts, warnings });
  } catch (error) {
    return errorResponse(error);
  }
}
