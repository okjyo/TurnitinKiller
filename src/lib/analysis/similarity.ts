// ============================================================
// Phase 6: Similarity / Originality analysis
//
// Three checks:
// 1. Exact-match search: Search public web for near-exact matches
// 2. Paraphrase risk: LLM flags passages that read as "too source-like"
// 3. Style consistency: Flag sections where writing style shifts
//
// This is NOT a Turnitin replacement. All user-facing text must
// be honest about this limitation.
// ============================================================

import { getLLMProvider } from "@/lib/llm";
import { getSearchProvider } from "@/lib/search";
import type { SearchResult } from "@/lib/search/types";
import type { Finding } from "./schema";
import { extractHeuristicCandidates } from "./heuristic-prefilter";
import {
  CANDIDATE_EXTRACTION_PROMPT,
  buildCandidateExtractionPrompt,
  SEARCH_PHRASE_PROMPT,
  buildSearchPhrasePrompt,
  MATCH_VERIFICATION_PROMPT,
  buildMatchVerificationPrompt,
  PARAPHRASE_RISK_PROMPT,
  buildParaphraseRiskPrompt,
  STYLE_CONSISTENCY_PROMPT,
  buildStyleConsistencyPrompt,
} from "@/lib/llm/prompts/similarity";

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const DEFAULT_MAX_SEARCH_QUERIES = 10;
const MAX_TEXT_LENGTH = 50_000; // ~10,000 words

const envMaxQueries = Number(process.env.MAX_SEARCH_QUERIES);
const MAX_SEARCH_QUERIES =
  Number.isFinite(envMaxQueries) && envMaxQueries > 0
    ? Math.min(Math.max(Math.round(envMaxQueries), 1), 20)
    : DEFAULT_MAX_SEARCH_QUERIES;

// ─────────────────────────────────────────────
// Types for internal use
// ─────────────────────────────────────────────

interface CandidatePassage {
  text: string;
  reason: string;
}

interface MatchVerification {
  matchType: "exact" | "paraphrase" | "false-positive";
  confidence: number;
  explanation: string;
}

interface ParaphraseRiskFinding {
  text: string;
  concern: string;
  suggestion: string;
}

interface StyleFinding {
  text: string;
  concern: string;
  suggestion: string;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface SimilarityAnalysisResult {
  findings: Finding[];
  searchQueriesUsed: number;
  searchAvailable: boolean;
}

/**
 * Run the full similarity analysis pipeline.
 *
 * Returns similarity findings (source-match, paraphrase-risk, style-inconsistency).
 * These are NOT merged into the main report — they're stored separately
 * and displayed in their own section.
 *
 * @param text The document body text (without bibliography)
 * @param documentId For logging
 */
export async function runSimilarityAnalysis(
  text: string,
  documentId: string
): Promise<SimilarityAnalysisResult> {
  const startTime = Date.now();
  const llm = getLLMProvider();
  const search = getSearchProvider();

  // Truncate if too long
  const truncatedText =
    text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const wasTruncated = text.length > MAX_TEXT_LENGTH;

  const findings: Finding[] = [];
  let searchQueriesUsed = 0;

  // ── Check 1: Exact-match search (if search provider available) ──
  if (search) {
    try {
      const exactMatchFindings = await runExactMatchSearch(
        truncatedText,
        llm,
        search
      );
      findings.push(...exactMatchFindings.findings);
      searchQueriesUsed = exactMatchFindings.queriesUsed;
    } catch (err) {
      console.error(
        `[Similarity] Exact-match search failed for document ${documentId}:`,
        err
      );
      // Don't fail the whole analysis — continue with LLM-only checks
    }
  }

  // ── Check 2: Paraphrase risk (LLM-only, no external lookup) ──
  try {
    const paraphraseFindings = await runParaphraseRiskCheck(truncatedText, llm);
    findings.push(...paraphraseFindings);
  } catch (err) {
    console.error(
      `[Similarity] Paraphrase risk check failed for document ${documentId}:`,
      err
    );
  }

  // ── Check 3: Style consistency (LLM-only, no external lookup) ──
  try {
    const styleFindings = await runStyleConsistencyCheck(truncatedText, llm);
    findings.push(...styleFindings);
  } catch (err) {
    console.error(
      `[Similarity] Style consistency check failed for document ${documentId}:`,
      err
    );
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[Similarity] Analysis complete for document ${documentId}: ` +
      `${findings.length} findings, ${searchQueriesUsed} search queries, ` +
      `${elapsed}ms` +
      (wasTruncated ? " (text truncated to 50k chars)" : "")
  );

  return {
    findings,
    searchQueriesUsed,
    searchAvailable: search !== null,
  };
}

// ─────────────────────────────────────────────
// Check 1: Exact-match search
// ─────────────────────────────────────────────

async function runExactMatchSearch(
  text: string,
  llm: ReturnType<typeof getLLMProvider>,
  search: NonNullable<ReturnType<typeof getSearchProvider>>
): Promise<{ findings: Finding[]; queriesUsed: number }> {
  // Step 1a: Heuristic pre-filter (free, deterministic)
  const heuristicCandidates = extractHeuristicCandidates(text, 10);

  // Step 1b: Ask LLM to identify suspicious passages
  const candidatesRaw = await llm.complete({
    systemPrompt: CANDIDATE_EXTRACTION_PROMPT,
    userPrompt: buildCandidateExtractionPrompt(text),
    temperature: 0.2,
    maxTokens: 2048,
    responseFormat: { type: "json_object" },
  });

  const llmCandidates = parseJson<CandidatePassage[]>(
    candidatesRaw,
    "candidates"
  );

  // Merge heuristic + LLM candidates, deduplicating overlapping passages
  const allCandidates = mergeCandidates(
    heuristicCandidates.map((c) => ({ text: c.text, reason: c.reason })),
    llmCandidates || []
  );

  if (allCandidates.length === 0) {
    return { findings: [], queriesUsed: 0 };
  }

  // Limit to MAX_SEARCH_QUERIES candidates
  const limitedCandidates = allCandidates.slice(0, MAX_SEARCH_QUERIES);

  // Step 2: Extract searchable phrases from each candidate
  const phrasePromises = limitedCandidates.map(async (candidate) => {
    try {
      const phraseRaw = await llm.complete({
        systemPrompt: SEARCH_PHRASE_PROMPT,
        userPrompt: buildSearchPhrasePrompt(candidate.text),
        temperature: 0.1,
        maxTokens: 256,
        responseFormat: { type: "json_object" },
      });

      const parsed = parseJson<{ phrase: string }>(phraseRaw, "phrase");
      return {
        candidate: candidate.text,
        reason: candidate.reason,
        phrase: typeof parsed === "string" ? parsed : parsed?.phrase || "",
      };
    } catch {
      return null;
    }
  });

  const phraseResults = (await Promise.all(phrasePromises)).filter(
    (r): r is NonNullable<typeof r> => r !== null && r.phrase.length > 0
  );

  // Step 3: Search for each phrase (run in parallel, but respect rate limits)
  const searchPromises = phraseResults.map(async (item) => {
    try {
      const results = await search.search(`"${item.phrase}"`, 3);
      return {
        ...item,
        results,
      };
    } catch {
      return { ...item, results: [] as SearchResult[] };
    }
  });

  const searchResults = await Promise.all(searchPromises);

  // Step 4: Verify each match with the LLM
  const findings: Finding[] = [];
  let queriesUsed = 0;

  for (const item of searchResults) {
    queriesUsed++;
    if (item.results.length === 0) continue;

    // Verify each search result
    for (const result of item.results.slice(0, 2)) {
      // Max 2 verifications per phrase
      try {
        const verifyRaw = await llm.complete({
          systemPrompt: MATCH_VERIFICATION_PROMPT,
          userPrompt: buildMatchVerificationPrompt(
            item.candidate,
            result.title,
            result.url,
            result.snippet
          ),
          temperature: 0.1,
          maxTokens: 512,
          responseFormat: { type: "json_object" },
        });

        const verification = parseJson<MatchVerification>(
          verifyRaw,
          "matchType"
        );

        if (
          verification &&
          verification.matchType !== "false-positive" &&
          verification.confidence >= 0.5
        ) {
          // Deduplicate: don't add if we already have a finding for this URL
          const alreadyFound = findings.some(
            (f) => f.sourceUrl === result.url
          );
          if (alreadyFound) continue;

          const isExact = verification.matchType === "exact";

          findings.push({
            id: crypto.randomUUID(),
            flaggedText: truncate(item.candidate, 500),
            issue: isExact
              ? `This passage closely matches content found on a public web page. ${verification.explanation}`
              : `This passage appears to paraphrase content from a public web page. ${verification.explanation}`,
            suggestedFix: isExact
              ? `Add a citation for this source: "${result.title}"`
              : `Rewrite this in your own words and cite the original idea from "${result.title}"`,
            category: "source-match",
            severity: isExact ? "high" : "medium",
            confidence: verification.confidence,
            source: "llm",
            sourceUrl: result.url,
          });
        }
      } catch {
        // Verification failed for this result — skip it
      }
    }
  }

  return { findings, queriesUsed };
}

// ─────────────────────────────────────────────
// Check 2: Paraphrase risk (LLM-only)
// ─────────────────────────────────────────────

async function runParaphraseRiskCheck(
  text: string,
  llm: ReturnType<typeof getLLMProvider>
): Promise<Finding[]> {
  const raw = await llm.complete({
    systemPrompt: PARAPHRASE_RISK_PROMPT,
    userPrompt: buildParaphraseRiskPrompt(text),
    temperature: 0.3,
    maxTokens: 2048,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJson<{ findings: ParaphraseRiskFinding[] }>(
    raw,
    "findings"
  );

  if (!parsed || !Array.isArray(parsed)) return [];

  return parsed.map((f) => ({
    id: crypto.randomUUID(),
    flaggedText: truncate(f.text, 500),
    issue: `This passage reads as unusually close to how a typical source on this topic would phrase it. ${f.concern}`,
    suggestedFix: f.suggestion
      ? `${f.suggestion} — If you used a source, add a citation.`
      : "Rewrite this in your own words. If you're drawing on a source, cite it.",
    category: "paraphrase-risk" as const,
    severity: "medium" as const,
    confidence: 0.6,
    source: "llm" as const,
    sourceUrl: null,
  }));
}

// ─────────────────────────────────────────────
// Check 3: Style consistency (LLM-only)
// ─────────────────────────────────────────────

async function runStyleConsistencyCheck(
  text: string,
  llm: ReturnType<typeof getLLMProvider>
): Promise<Finding[]> {
  const raw = await llm.complete({
    systemPrompt: STYLE_CONSISTENCY_PROMPT,
    userPrompt: buildStyleConsistencyPrompt(text),
    temperature: 0.3,
    maxTokens: 2048,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJson<{ findings: StyleFinding[] }>(raw, "findings");

  if (!parsed || !Array.isArray(parsed)) return [];

  return parsed.map((f) => ({
    id: crypto.randomUUID(),
    flaggedText: truncate(f.text, 500),
    issue: `This section's writing style differs noticeably from the rest of your paper. ${f.concern}`,
    suggestedFix: f.suggestion
      ? `${f.suggestion} — This may indicate unattributed copy-paste.`
      : "Review this section and rewrite it in your own voice. If you used a source, cite it.",
    category: "style-inconsistency" as const,
    severity: "low" as const,
    confidence: 0.5,
    source: "llm" as const,
    sourceUrl: null,
  }));
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Parse a JSON string from the LLM, extracting a specific field.
 * Handles both direct JSON and markdown-wrapped JSON.
 */
function parseJson<T>(raw: string, field: string): T | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim());
      } catch {
        return null;
      }
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const value = obj[field];

  if (value === undefined || value === null) return null;

  return value as T;
}

/**
 * Truncate text to a maximum length, adding "..." if truncated.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Merge heuristic and LLM candidates, deduplicating overlapping passages.
 * Heuristic candidates come first (they're free), then LLM candidates.
 */
function mergeCandidates(
  heuristic: CandidatePassage[],
  llm: CandidatePassage[]
): CandidatePassage[] {
  const merged: CandidatePassage[] = [];
  const seenNormalized = new Set<string>();

  // Add heuristic candidates first
  for (const c of heuristic) {
    const normalized = normalizeForComparison(c.text);
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      merged.push({ ...c, reason: `[Heuristic] ${c.reason}` });
    }
  }

  // Add LLM candidates that don't overlap
  for (const c of llm) {
    const normalized = normalizeForComparison(c.text);
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      merged.push({ ...c, reason: `[LLM] ${c.reason}` });
    }
  }

  return merged;
}

/**
 * Normalize text for comparison (same logic as merge.ts).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
