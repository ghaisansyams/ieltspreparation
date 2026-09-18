// Splitting extracted PDF text into AI-sized chunks without cutting a
// vocabulary row in half. Rows in a vocabulary table usually start with
// "<number> <Word> /ipa/", which is where we prefer to cut.

const ROW_START = /(?=\s\d{1,4}\s+[A-Z][A-Za-z'’-]+(?:\s\((?:A1|A2|B1|B2|C1|C2)\))?\s+\/)/;

export function chunkPdfText(pages: string[], maxChars = 7000): string[] {
  const chunks: string[] = [];
  for (const page of pages) {
    const text = ` ${page.replace(/\s+/g, " ").trim()}`;
    if (!text.trim()) continue;
    let buf = "";
    for (const part of text.split(ROW_START)) {
      if (buf && buf.length + part.length > maxChars) {
        chunks.push(buf.trim());
        buf = "";
      }
      buf += part;
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  return chunks.flatMap((c) => (c.length > maxChars * 1.5 ? hardSplit(c, maxChars) : [c]));
}

function hardSplit(text: string, size: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = Math.max(rest.lastIndexOf(". ", size), Math.floor(size * 0.6));
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

/** Recognises the learner's original "Jay's Vocabulary" PDF, which ships pre-transcribed. */
export function isKnownSourceDocument(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return /Pronounciation/.test(t) && /Distinct \/dɪˈstɪŋkt\//.test(t) && /Sophisticated/.test(t) && /Soaked/.test(t);
}
