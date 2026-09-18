// Band descriptors used to calibrate the examiner model.
//
// Condensed from the official "IELTS Writing Band Descriptors" (public
// document, updated May 2023, © IELTS partners: British Council, IDP: IELTS
// Australia and Cambridge University Press & Assessment). Kept as structured
// data so the prompt, the UI and the tests all read the same source.
//
// Two rules from that document drive everything else:
//   • a script must FULLY fit the positive features of a level to earn it;
//   • the listed `limiting` features are the bolded negative ones — they cap
//     the rating no matter how strong the rest looks.

import type { CriterionKey, TaskType } from "./band";

export interface BandDescriptor {
  band: number;
  positive: string[];
  /** Bolded negative features in the official table: these limit the rating. */
  limiting?: string[];
}

type CriterionRubric = Record<CriterionKey, BandDescriptor[]>;

const COHERENCE: BandDescriptor[] = [
  { band: 9, positive: ["The message can be followed effortlessly.", "Cohesion very rarely attracts attention; any lapses are minimal.", "Paragraphing is skilfully managed."] },
  { band: 8, positive: ["The message can be followed with ease.", "Information and ideas are logically sequenced and cohesion is well managed; occasional lapses.", "Paragraphing is sufficient and appropriate."] },
  { band: 7, positive: ["Logically organised with clear progression; a few minor lapses.", "A range of cohesive devices, including reference and substitution, used flexibly but with some inaccuracy or over/under use."] },
  { band: 6, positive: ["Generally coherent arrangement with clear overall progression.", "Cohesive devices used to some good effect, but cohesion within or between sentences can be faulty or mechanical through misuse, overuse or omission.", "Reference and substitution may lack flexibility or clarity, causing repetition or error."] },
  { band: 5, positive: ["Organisation is evident but not wholly logical; overall progression may be lacking, though an underlying coherence remains.", "Ideas can be followed but sentences are not fluently linked.", "Cohesive devices are limited or overused, with some inaccuracy.", "Writing may be repetitive through inadequate or inaccurate reference and substitution."] },
  { band: 4, positive: ["Ideas are evident but not arranged coherently and there is no clear progression.", "Relationships between ideas are unclear or inadequately marked; only basic cohesive devices, often inaccurate or repetitive.", "Substitution and referencing are inaccurate or absent."] },
  { band: 3, positive: ["No apparent logical organisation; ideas are discernible but hard to relate to one another.", "Minimal sequencers or cohesive devices, and those used need not signal a logical relationship.", "Referencing is difficult to identify."] },
  { band: 2, positive: ["Little evidence of control of organisational features."], limiting: ["Little relevant message, or the entire response is off topic."] },
  { band: 1, positive: ["The writing fails to communicate any message; it reads as the work of a virtual non-writer."], limiting: ["Responses of 20 words or fewer are rated Band 1."] },
];

const LEXICAL: BandDescriptor[] = [
  { band: 9, positive: ["Full flexibility and precise use.", "A wide range of vocabulary used accurately and appropriately, with very natural and sophisticated control of lexical features.", "Minor spelling or word-formation errors are extremely rare."] },
  { band: 8, positive: ["A wide resource used fluently and flexibly to convey precise meaning.", "Skilful use of uncommon or idiomatic items, despite occasional inaccuracy in word choice and collocation.", "Occasional spelling or word-formation errors with minimal impact."] },
  { band: 7, positive: ["Resource is sufficient for some flexibility and precision.", "Some ability with less common or idiomatic items.", "Awareness of style and collocation, though inappropriacies occur.", "Only a few spelling or word-formation errors; they do not detract from clarity."] },
  { band: 6, positive: ["Generally adequate and appropriate for the task.", "Meaning is generally clear despite a rather restricted range or imprecise word choice.", "A risk-taker shows wider range with higher inaccuracy.", "Some spelling or word-formation errors, but they do not impede communication."] },
  { band: 5, positive: ["Limited but minimally adequate resource.", "Simple vocabulary may be accurate, but the range does not permit much variation.", "Frequent lapses in appropriacy of word choice; inflexibility shows as simplification or repetition.", "Spelling or word-formation errors are noticeable and may cause the reader some difficulty."] },
  { band: 4, positive: ["Basic vocabulary used repetitively.", "Inappropriate use of lexical chunks (memorised phrases, formulaic language, language lifted from the input)."], limiting: ["Resource is inadequate for, or unrelated to, the task.", "Word choice, word formation or spelling may impede meaning."] },
  { band: 3, positive: ["Possible over-dependence on input material or memorised language.", "Very limited control of word choice and spelling; errors predominate and may severely impede meaning."], limiting: ["Resource is inadequate, which may be because the response is significantly under length."] },
  { band: 2, positive: ["Extremely limited resource with few recognisable strings apart from memorised phrases.", "No apparent control of word formation or spelling."] },
  { band: 1, positive: ["No resource apparent beyond a few isolated words."], limiting: ["Responses of 20 words or fewer are rated Band 1."] },
];

const GRAMMAR: BandDescriptor[] = [
  { band: 9, positive: ["A wide range of structures used with full flexibility and control.", "Punctuation and grammar are appropriate throughout; minor errors are extremely rare."] },
  { band: 8, positive: ["A wide range of structures used flexibly and accurately.", "The majority of sentences are error-free and punctuation is well managed.", "Occasional non-systematic errors with minimal impact."] },
  { band: 7, positive: ["A variety of complex structures used with some flexibility and accuracy.", "Grammar and punctuation are generally well controlled; error-free sentences are frequent.", "A few grammar errors persist but do not impede communication."] },
  { band: 6, positive: ["A mix of simple and complex sentence forms, but flexibility is limited.", "Complex structures are less accurate than simple ones.", "Errors in grammar and punctuation occur but rarely impede communication."] },
  { band: 5, positive: ["Range of structures is limited and rather repetitive.", "Complex sentences are attempted but tend to be faulty; greatest accuracy is on simple sentences.", "Grammatical errors may be frequent and cause the reader some difficulty; punctuation may be faulty."] },
  { band: 4, positive: ["A very limited range of structures.", "Some structures are accurate, but grammatical errors are frequent and may impede meaning.", "Punctuation is often faulty or inadequate."], limiting: ["Subordinate clauses are rare and simple sentences predominate."] },
  { band: 3, positive: ["Sentence forms are attempted, but errors in grammar and punctuation predominate (except in memorised phrases or language from the input) and prevent most meaning from coming through."], limiting: ["Length may be insufficient to provide evidence of control of sentence forms."] },
  { band: 2, positive: ["Little or no evidence of sentence forms, except in memorised phrases."] },
  { band: 1, positive: ["No rateable language is evident."], limiting: ["Responses of 20 words or fewer are rated Band 1."] },
];

const TASK1_ACHIEVEMENT: BandDescriptor[] = [
  { band: 9, positive: ["All requirements of the task are fully and appropriately satisfied.", "Lapses in content are extremely rare."] },
  { band: 8, positive: ["Covers all requirements appropriately, relevantly and sufficiently.", "Key features are skilfully selected, clearly presented, highlighted and illustrated.", "Occasional omissions or lapses in content."] },
  { band: 7, positive: ["Covers the requirements of the task; content is relevant and accurate with few omissions or lapses; format is appropriate.", "Key features are covered and clearly highlighted, but could be more fully or more appropriately illustrated or extended.", "Presents a clear overview; data are appropriately categorised and main trends or differences are identified."] },
  { band: 6, positive: ["Focuses on the requirements, in an appropriate format.", "Key features are covered and adequately highlighted; a relevant overview is attempted.", "Information is appropriately selected and supported with figures or data.", "Some irrelevant, inappropriate or inaccurate information may appear in detail or when illustrating main points.", "Some details may be missing or excessive; further extension or illustration may be needed."] },
  { band: 5, positive: ["Generally addresses the requirements; the format may be inappropriate in places.", "Key features selected are not adequately covered; recounting of detail is mainly mechanical.", "A tendency to focus on details without referring to the bigger picture.", "Limited detail when extending and illustrating main points."], limiting: ["There may be no data to support the description.", "Irrelevant, inappropriate or inaccurate material in key areas detracts from task achievement."] },
  { band: 4, positive: ["An attempt to address the task; few key features are selected.", "Features presented may be irrelevant, repetitive, inaccurate or inappropriate."], limiting: ["The format may be inappropriate."] },
  { band: 3, positive: ["Does not address the requirements, possibly through misunderstanding the data or diagram.", "Features presented are largely irrelevant; limited information used repetitively."] },
  { band: 2, positive: ["The content barely relates to the task."] },
  { band: 1, positive: ["Any copied rubric must be discounted."], limiting: ["Responses of 20 words or fewer are rated Band 1.", "The content is wholly unrelated to the task."] },
];

const TASK2_RESPONSE: BandDescriptor[] = [
  { band: 9, positive: ["The prompt is appropriately addressed and explored in depth.", "A clear, fully developed position directly answers the question.", "Ideas are relevant, fully extended and well supported; lapses are extremely rare."] },
  { band: 8, positive: ["The prompt is appropriately and sufficiently addressed.", "A clear, well-developed position responds to the question.", "Ideas are relevant, well extended and supported; occasional omissions or lapses."] },
  { band: 7, positive: ["The main parts of the prompt are appropriately addressed.", "A clear and developed position is presented.", "Main ideas are extended and supported, though there may be over-generalisation or a lack of focus and precision in support."] },
  { band: 6, positive: ["The main parts are addressed, though some more fully than others; an appropriate format is used.", "A position directly relevant to the prompt is presented, although conclusions may be unclear, unjustified or repetitive.", "Main ideas are relevant but some are insufficiently developed or unclear; some support is less relevant or inadequate."] },
  { band: 5, positive: ["The format may be inappropriate in places.", "A position is expressed, but development is not always clear.", "Main ideas are limited and insufficiently developed, possibly with irrelevant detail and some repetition."], limiting: ["The main parts of the prompt are incompletely addressed."] },
  { band: 4, positive: ["The prompt is tackled minimally, or the answer is tangential, possibly through misunderstanding.", "A position is discernible but the reader has to search for it.", "Main ideas are hard to identify and may lack relevance, clarity or support; large parts may be repetitive."], limiting: ["The format may be inappropriate."] },
  { band: 3, positive: ["No part of the prompt is adequately addressed, or the prompt has been misunderstood.", "No relevant position can be identified; few ideas, irrelevant or insufficiently developed."] },
  { band: 2, positive: ["Content is barely related to the prompt; no position can be identified.", "Glimpses of one or two ideas without development."] },
  { band: 1, positive: ["Any copied rubric must be discounted."], limiting: ["Responses of 20 words or fewer are rated Band 1.", "The content is wholly unrelated to the prompt."] },
];

export const RUBRIC: Record<TaskType, CriterionRubric> = {
  task1: { task: TASK1_ACHIEVEMENT, coherence: COHERENCE, lexical: LEXICAL, grammar: GRAMMAR },
  task2: { task: TASK2_RESPONSE, coherence: COHERENCE, lexical: LEXICAL, grammar: GRAMMAR },
};

/** Rules in the descriptors that are arithmetic, not judgement — enforced in code. */
export const HARD_RULES = {
  /** "Responses of 20 words or fewer are rated at Band 1." */
  band1MaxWords: 20,
  /** Band 0: not attempted, wrong language throughout, or wholly memorised. */
  band0Reasons: ["did not attempt the question", "wrote in a language other than English", "the answer is totally memorised"],
} as const;

/** The rubric as prompt text, so the examiner model marks against the real descriptors. */
export function rubricPrompt(task: TaskType): string {
  const names: Record<CriterionKey, string> = {
    task: task === "task1" ? "TASK ACHIEVEMENT" : "TASK RESPONSE",
    coherence: "COHERENCE AND COHESION",
    lexical: "LEXICAL RESOURCE",
    grammar: "GRAMMATICAL RANGE AND ACCURACY",
  };
  return (Object.keys(names) as CriterionKey[])
    .map((key) => {
      const rows = RUBRIC[task][key]
        .map((d) => {
          const limiting = d.limiting?.length ? `\n     LIMITING (caps the band): ${d.limiting.join(" ")}` : "";
          return `  Band ${d.band}: ${d.positive.join(" ")}${limiting}`;
        })
        .join("\n");
      return `${names[key]}\n${rows}`;
    })
    .join("\n\n");
}
