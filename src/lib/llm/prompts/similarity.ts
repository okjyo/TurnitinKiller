// ============================================================
// LLM PROMPT TEMPLATES — Similarity / Originality Checks
//
// These prompts drive the Phase 6 similarity analysis.
//
// CRITICAL FRAMING RULE:
//   - Every prompt MUST instruct the LLM to be honest about
//     limitations (public web only, not Turnitin)
//   - Never use language that implies detection evasion
//   - Focus on helping students attribute properly, not on
//     "beating" a similarity checker
// ============================================================

/**
 * System prompt for candidate extraction.
 * Asks the LLM to identify sentences that look like they could
 * be lifted from a common source.
 */
export const CANDIDATE_EXTRACTION_PROMPT = `You are helping a student check their paper for accidental plagiarism. Your job is to identify sentences in their text that look like they might have been copied or closely paraphrased from a public source.

Look for sentences that are:
- Long (>20 words) and unusually formal or academic
- Generic for the topic — they could appear in any textbook or Wikipedia article
- Statistically unlikely to be the student's own phrasing (jargon-heavy, encyclopedic tone)
- Specific factual claims with precise wording (not vague summaries)

Do NOT flag:
- Short sentences or fragments
- Sentences that are clearly the student's own analysis or opinion
- Common phrases that any student might write ("In conclusion...", "This paper examines...")
- Properly quoted and cited text

OUTPUT FORMAT:
Respond with valid JSON:
{
  "candidates": [
    {
      "text": "the exact sentence from the paper (verbatim, 10-100 words)",
      "reason": "brief explanation of why this looks like it could be from a source"
    }
  ]
}

Return at most 10 candidates. If the text has no suspicious passages, return {"candidates": []}.`;

/**
 * User prompt for candidate extraction.
 */
export function buildCandidateExtractionPrompt(text: string): string {
  return `Please identify sentences in this student paper that look like they might have been copied or closely paraphrased from a public source.

---ASSIGNMENT TEXT---
${text}

Remember: respond with valid JSON only. Be selective — only flag passages that genuinely look like they could be from a source.`;
}

/**
 * System prompt for search phrase extraction.
 * Takes a suspicious passage and extracts a distinctive, searchable phrase.
 */
export const SEARCH_PHRASE_PROMPT = `You are extracting a searchable phrase from a suspicious passage in a student paper. Your job is to pick the most distinctive 5-10 word chunk that would likely appear verbatim in a source if this passage was copied.

RULES:
- Pick 5-10 consecutive words from the passage (do not invent new words)
- Choose the most distinctive, specific part — not generic words
- Avoid articles, prepositions, and common verbs at the edges
- The phrase should be specific enough to find the original source
- Do not include quotation marks or citation markers

OUTPUT FORMAT:
Respond with valid JSON:
{
  "phrase": "the 5-10 word searchable phrase"
}`;

/**
 * User prompt for search phrase extraction.
 */
export function buildSearchPhrasePrompt(passage: string): string {
  return `Extract the most searchable 5-10 word phrase from this passage:

"${passage}"

Choose the part most likely to appear verbatim in a source document.`;
}

/**
 * System prompt for match verification.
 * Compares student text against a search result to determine if it's a real match.
 */
export const MATCH_VERIFICATION_PROMPT = `You are verifying whether a passage in a student paper matches content found on a public web page. Be careful and accurate — false accusations are worse than missed matches.

Compare the student's text against the search result snippet and determine:

1. **Near-exact match** (>80% word overlap): The student's text is nearly identical to the source. This needs a citation.
2. **Close paraphrase** (>60% structural similarity): The student's text follows the same structure and uses many of the same phrases, but with some word substitutions. This might need attribution.
3. **False positive**: The texts discuss the same topic but are clearly independently written. Different structure, different phrasing, different examples.

OUTPUT FORMAT:
{
  "matchType": "exact" | "paraphrase" | "false-positive",
  "confidence": 0.0-1.0,
  "explanation": "brief explanation of why this is or isn't a match"
}

IMPORTANT:
- Be conservative. If you're unsure, classify as "false-positive"
- Common knowledge facts (e.g., "Water boils at 100°C") are not plagiarism even if worded similarly
- Two papers on the same topic will naturally share some vocabulary — that's not a match
- Only flag genuine cases where attribution is needed`;

/**
 * User prompt for match verification.
 */
export function buildMatchVerificationPrompt(
  studentText: string,
  sourceTitle: string,
  sourceUrl: string,
  sourceSnippet: string
): string {
  return `Does this student passage match the source content?

---STUDENT TEXT---
"${studentText}"

---SOURCE---
Title: ${sourceTitle}
URL: ${sourceUrl}
Content: ${sourceSnippet}

Determine if the student's text is a near-exact match, close paraphrase, or false positive.`;
}

/**
 * System prompt for paraphrase risk assessment.
 * Flags paragraphs that read as unusually close to "how a typical source
 * would phrase it" — no external lookup needed.
 */
export const PARAPHRASE_RISK_PROMPT = `You are assessing whether passages in a student paper read as suspiciously close to how a typical source on this topic would phrase things. This is a heuristic judgment — you are NOT finding specific sources, just flagging passages that feel "too source-like."

Look for paragraphs that:
- Use textbook-encyclopedic phrasing that doesn't sound like a student writing
- Follow the exact same organizational structure as a typical source (definition → history → examples)
- Use jargon or technical terms without demonstrating understanding
- Could be a light rewrite of a Wikipedia or textbook paragraph

Do NOT flag:
- Passages where the student demonstrates original analysis or insight
- Well-written paragraphs that just happen to use academic language
- Properly cited and quoted material
- Common knowledge explanations that any student would write similarly

OUTPUT FORMAT:
{
  "findings": [
    {
      "text": "the suspicious passage (verbatim, 20-100 words)",
      "concern": "why this reads as too source-like",
      "suggestion": "how the student could rewrite this in their own voice"
    }
  ]
}

Return at most 5 findings. If nothing stands out, return {"findings": []}.`;

/**
 * User prompt for paraphrase risk assessment.
 */
export function buildParaphraseRiskPrompt(text: string): string {
  return `Please assess whether any passages in this student paper read as suspiciously close to how a typical source on this topic would phrase things. This is about writing voice, not specific matching.

---ASSIGNMENT TEXT---
${text}

Remember: be selective. Only flag passages that genuinely feel "too source-like." If the student's writing sounds natural throughout, say so.`;
}

/**
 * System prompt for style consistency check.
 * Identifies sections where vocabulary/sentence complexity shifts noticeably.
 */
export const STYLE_CONSISTENCY_PROMPT = `You are analyzing a student paper for style consistency. Your job is to identify sections where the writing style shifts noticeably — a common sign of unattributed copy-paste.

Look for:
- Sudden jumps in vocabulary complexity (simple language → dense jargon)
- Sudden changes in sentence structure (short, clear sentences → long, complex sentences or vice versa)
- Sections that sound like a different author wrote them
- Paragraphs that don't match the paper's overall voice or tone

Do NOT flag:
- Intentional style shifts (e.g., switching from narrative to analysis)
- Sections where the student is quoting or paraphrasing a source (these should be cited)
- Natural variations in writing style across a long paper
- Technical sections that necessarily use more jargon

OUTPUT FORMAT:
{
  "findings": [
    {
      "text": "the inconsistent passage (verbatim, 20-100 words)",
      "concern": "how this passage differs from the rest of the paper",
      "suggestion": "how to make this section fit the paper's voice"
    }
  ]
}

Return at most 3 findings. If the paper's style is consistent throughout, return {"findings": []}.`;

/**
 * User prompt for style consistency check.
 */
export function buildStyleConsistencyPrompt(text: string): string {
  return `Please analyze this student paper for style consistency. Identify any sections where the writing style shifts noticeably from the rest of the paper.

---ASSIGNMENT TEXT---
${text}

Remember: be selective. Only flag genuine style shifts that suggest the passage may have been copied from elsewhere. If the paper's style is consistent, say so.`;
}
