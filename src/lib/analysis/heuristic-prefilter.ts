// ============================================================
// Heuristic pre-filter for similarity candidate extraction
//
// Runs BEFORE the LLM candidate extraction as a free supplement.
// Uses deterministic rules to catch passages the LLM might miss:
// - Long sentences (>25 words)
// - Passive voice density
// - Unusual vocabulary / encyclopedic phrasing patterns
//
// These candidates are merged with the LLM's picks, not
// replaced by them.
// ============================================================

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

/** Sentences longer than this are suspicious */
const MIN_SENTENCE_LENGTH_WORDS = 20;

/** Common passive voice indicators */
const PASSIVE_INDICATORS = [
  /\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/i,
  /\b(?:is|are|was|were|be|been|being)\s+\w+en\b/i,
];

/** Encyclopedic / textbook phrasing patterns */
const ENCYCLOPEDIC_PATTERNS = [
  /\b(?:is defined as|refers to|is characterized by|can be described as)\b/i,
  /\b(?:according to|as stated by|as noted by|as described by)\b/i,
  /\b(?:it is important to note|it should be noted|it is worth noting)\b/i,
  /\b(?:in the context of|with respect to|in terms of|with regard to)\b/i,
  /\b(?:has been shown to|has been demonstrated|has been established)\b/i,
  /\b(?:is widely recognized|is generally accepted|is commonly understood)\b/i,
];

/** Phrases that suggest the text is summarizing a source */
const SOURCE_SUMMARY_PATTERNS = [
  /\b(?:the study found|the research showed|the results indicate)\b/i,
  /\b(?:according to the study|the authors concluded|the findings suggest)\b/i,
  /\b(?:this theory proposes|this framework suggests|this model posits)\b/i,
];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface HeuristicCandidate {
  text: string;
  reason: string;
  score: number; // 0-1, higher = more suspicious
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

/**
 * Extract suspicious passages from text using deterministic heuristics.
 * Returns candidates sorted by suspicion score (highest first).
 *
 * This is a FREE supplement to the LLM candidate extraction —
 * no API calls, no cost.
 */
export function extractHeuristicCandidates(
  text: string,
  maxCandidates: number = 10
): HeuristicCandidate[] {
  const sentences = splitIntoSentences(text);
  const candidates: HeuristicCandidate[] = [];

  for (const sentence of sentences) {
    const wordCount = countWords(sentence);

    // Skip very short sentences
    if (wordCount < MIN_SENTENCE_LENGTH_WORDS) continue;

    let score = 0;
    const reasons: string[] = [];

    // ── Length score ──
    if (wordCount > 40) {
      score += 0.3;
      reasons.push("very long sentence");
    } else if (wordCount > 25) {
      score += 0.2;
      reasons.push("long sentence");
    }

    // ── Passive voice score ──
    const passiveCount = PASSIVE_INDICATORS.filter((p) =>
      p.test(sentence)
    ).length;
    if (passiveCount >= 2) {
      score += 0.25;
      reasons.push("multiple passive constructions");
    } else if (passiveCount >= 1) {
      score += 0.1;
      reasons.push("passive voice");
    }

    // ── Encyclopedic phrasing score ──
    const encyclopedicMatches = ENCYCLOPEDIC_PATTERNS.filter((p) =>
      p.test(sentence)
    ).length;
    if (encyclopedicMatches >= 2) {
      score += 0.3;
      reasons.push("encyclopedic phrasing");
    } else if (encyclopedicMatches >= 1) {
      score += 0.15;
      reasons.push("textbook-style phrasing");
    }

    // ── Source summary score ──
    const summaryMatches = SOURCE_SUMMARY_PATTERNS.filter((p) =>
      p.test(sentence)
    ).length;
    if (summaryMatches >= 1) {
      score += 0.2;
      reasons.push("summarizing a source");
    }

    // ── Vocabulary complexity score ──
    const avgWordLength = getAverageWordLength(sentence);
    if (avgWordLength > 7) {
      score += 0.15;
      reasons.push("high vocabulary complexity");
    }

    // Only include if score is above threshold
    if (score >= 0.25) {
      candidates.push({
        text: sentence.trim(),
        reason: reasons.join("; "),
        score: Math.min(score, 1),
      });
    }
  }

  // Sort by score descending, take top N
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Split text into sentences.
 * Handles common abbreviations and edge cases.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  // But not on abbreviations like "e.g.", "i.e.", "Dr.", etc.
  const raw = text.split(/(?<=[.!?])\s+/);

  // Filter out empty strings and very short fragments
  return raw.filter((s) => s.trim().length > 10);
}

/**
 * Count words in a sentence.
 */
function countWords(sentence: string): number {
  return sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Get average word length (a proxy for vocabulary complexity).
 */
function getAverageWordLength(sentence: string): number {
  const words = sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  const totalLength = words.reduce((sum, w) => sum + w.length, 0);
  return totalLength / words.length;
}
