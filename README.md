# Lexiband — Vocabulary Hub

A personal second brain for English vocabulary. It is built around one loop:

**Learn → Review → Play → Use → Get feedback → Repeat**

It starts from *Jay's Vocabulary* (148 entries, transcribed row by row from the PDF) and keeps each entry's full structure: pronunciation, part of speech, 3 meanings, 3 synonyms, and 3 example sentences with Indonesian translations.

## Quick start

```bash
npm install                      # .npmrc sets legacy-peer-deps (npm's peer resolver crashes without it)
cp .env.example .env.local       # optional: add an AI key and/or Supabase
npm run dev                      # http://localhost:3000
```

Then open **Import → Preview 148 entries → Import Selected**.

Everything runs **without any keys**. Reviews, all 9 games, search, filters, the word graph, statistics, CSV/Excel/TXT import and importing your own PDF all work offline. AI features switch on when a provider key is present.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build and start |
| `npm test` | Unit tests: source data integrity, SRS, priority, search, import parsing |
| `npm run typecheck` | TypeScript |

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4**, with design tokens in `src/app/globals.css`. Light and dark themes. Chart colours follow a colour-blind-validated palette.
- **Zustand + IndexedDB** as the local-first store (`src/lib/store`)
- **Supabase / PostgreSQL** for optional cloud sync with Row Level Security (`supabase/migrations`, `src/lib/sync`)
- **AI provider abstraction** (`src/lib/ai`). Claude (`claude-opus-5`) is the default, using structured outputs, streaming, image input and server-side refusal fallbacks. Any OpenAI-compatible endpoint also works.
- **d3-force** for the word graph, **unpdf** for PDF text, **papaparse** and **read-excel-file** for spreadsheets

## Environment

See `.env.example`. Keys are only read on the server and never reach the browser.

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `anthropic` or `openai-compatible`. If unset, the first provider with a key is used. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude (default model `claude-opus-5`) |
| `OPENAI_COMPATIBLE_BASE_URL`, `_API_KEY`, `_MODEL` | Any OpenAI-compatible endpoint |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enables cloud sync. AI routes then require a signed-in session. |
| `APP_ACCESS_TOKEN` | Without Supabase, protects the AI routes with a shared token (enter it in Settings) |

> **Deploying publicly?** Set Supabase or `APP_ACCESS_TOKEN`. Otherwise anyone with the URL can spend your AI credit.

### Cloud sync (optional)

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Set the two `NEXT_PUBLIC_SUPABASE_*` variables and restart.
4. Go to **Settings → Cloud sync** and sign in.

The local library is merged on first sign-in: newest entry wins, and learning history is combined.

## Data model

`src/lib/types.ts` mirrors the SQL schema.

- **Vocabulary**: `word`, `pronunciation`, `partOfSpeech`, `meaning1-3`, `synonym1-3`, `example1-3` + `exampleNTranslation`, `cefr` + `cefrSource` (`source` / `estimated` / `manual`), `definition`, `difficulty`, `frequency`, `tags`, `wordFamily`, `collocations`, `commonMistakes`, `ieltsRelevance`, `origin`, `aiFields`, `needsReview`, `reviewNotes`, `contexts`, timestamps
- **LearningProgress**: `status` (new / learning / review / mastered), `mastery`, `reviewCount`, `correctCount`, `incorrectCount`, `streak`, `confidence`, `easeFactor`, `intervalDays`, `lapses`, `lastReviewedAt`, `nextReviewAt`
- **QuizAttempt**: `vocabularyId`, `quizType`, `isCorrect`, `responseTime`, `createdAt`
- **Profile**: XP, achievements, daily challenges, daily activity, settings

## Data-quality rules

- **Source data is never overwritten.** Your PDF text is kept exactly as written, including its spelling. The only changes are removing PDF line wraps and the parentheses around translations.
- **AI output is always labelled.** Fields in `aiFields` show an *AI generated* badge until you edit or verify them. *Enhance with AI* only proposes values for empty or AI-owned fields, and you accept each one.
- **CEFR is labelled *Estimated*** unless your notes state it (e.g. `Multitude (C1)`) or you confirm it.
- **Incomplete rows are flagged *Needs Review*,** never filled in silently. In the source PDF these are:
  - rows 16, 44, 55, 67, 108, 111 and 122
  - e.g. #111 *Inconclusive* has only a word and type, and #67 *Collision* has two examples that belong to #68.
- **AI suggestions never replace what you wrote.** Sentence feedback shows suggestions and an optional improved version.

## IELTS Writing

**Full writing task** (IELTS Mode → Full writing task) marks a complete Task 1 or Task 2 response the way the test does:

- Four criteria, each 0–9 in half bands: **Task Achievement** (Task 1) or **Task Response** (Task 2), **Coherence and Cohesion**, **Lexical Resource**, **Grammatical Range and Accuracy**.
- Marking follows the **official IELTS Writing band descriptors** (public version, updated May 2023), held as structured data in `src/lib/ielts/rubric.ts` and sent to the examiner model as the band tables it must match — bands 9 down to 1, with the negative "limiting" features marked so they cap a band. The same data renders in the sidebar, so you can read the descriptor you were marked against.
- Two rules from that document are enforced in code rather than left to the model (`src/lib/ielts/hard-rules.ts`): a response of **20 words or fewer is Band 1** (no AI call is made), and every band the model returns is clamped to a legal 0–9 half band.
- The task band is the average of the four criteria, rounded to the nearest half band, with .25 and .75 rounding up (`src/lib/ielts/band.ts`). All of this is covered by tests.
- Word minimums are enforced and shown: 150 for Task 1, 250 for Task 2. Under-length is flagged, penalised under TA/TR, and noted as limiting LR and GRA.
- Every band comes back with short quotes from your own text as evidence, plus what would move it up half a band. Corrections quote your sentence and suggest an alternative — your response is never rewritten.

Task 1 has three sources of stimulus:

| Source | What it is |
|---|---|
| **Random chart** | A fresh stimulus generated per seed (`src/lib/ielts/random-task.ts`): line graph, bar chart, table, paired pie charts or a process diagram, with plausible trends and proportions that add up to 100. The seed is in the task id, so a chart can be reopened with its draft. |
| **Sample tasks** | The four hand-written tasks. |
| **Your image** | Upload, drag or paste a screenshot of any real Task 1 (chart, table, diagram). It is downscaled in the browser to 1568px, sent with your writing as a base64 image block, and never stored. The examiner reports back **how it read your image** so you can check it did not misread the data. |

Caveats, stated in the app too: it is an estimate from one task, not an official result; the real Writing score combines Task 1 and Task 2 with Task 2 weighted double, and is marked by certified examiners.

**Sentence practice** is the quick drill for a single word. It deliberately shows **no band**, because a band describes a whole task response.

## How learning works

- **Spaced repetition** (`src/lib/learning/srs.ts`) is SM-2 style. You rate each recall *Again / Hard / Good / Easy*, and missed answers can only be rated Again or Hard.
- **Mastery** blends three things: the review interval, lifetime accuracy and recent confidence.
- **The exercise type rotates** as a word matures: flashcard → multiple choice → sentence completion → translation → synonyms / use it in a sentence.
- **Priority** (`priority.ts`) favours words you frequently get wrong, words not seen recently, low-confidence words and new words. This drives *Words You Keep Forgetting*, game word selection and the review order.
- **Game answers** count as a lighter signal. A wrong answer pulls the word back into today's queue.
- **Daily challenge** (`src/lib/games/daily.ts`) is fixed for the whole day: 5 review words, 3 new words, a synonym challenge, a sentence challenge and an AI mini story.

## Project layout

```
src/
  app/                 pages + API routes (api/ai/*, api/import/pdf)
  components/          ui primitives, vocab cards/forms, charts, games, tutor
  data/source/         the transcribed PDF (rows) + AI enrichment + source notes
  lib/
    ai/                provider interface, Claude + OpenAI-compatible, prompts, schemas
    games/             question generators, game catalog, daily plan
    import/            CSV/XLSX/TXT mapping, PDF chunking
    learning/          SRS, priority, XP/levels/achievements
    store/             Zustand store (IndexedDB) + selectors
    sync/              Supabase client, mapping, merge, sync engine
    vocab/             field helpers, word forms, search, relations, source import
supabase/migrations/   SQL schema with RLS
```
