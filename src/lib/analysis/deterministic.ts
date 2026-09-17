// ============================================================
// Phase 1: Deterministic analysis
//
// Runs regex-based citation/reference checks with zero LLM calls.
// All findings from this phase have confidence 1.0.
//
// KEY MATCHING STRATEGY:
// Both citations and bib entries are normalized to `firstauthor:year`.
// "Smith et al. (2023)", "Smith, J., Brown, A. (2023)", and
// "Smith (2023)" all normalize to `smith:2023`.
// ============================================================

import type { Finding, FindingCategory } from "./schema";
import { SEVERITY_MAP, DEFAULT_CONFIDENCE } from "./severity";

// ─────────────────────────────────────────────
// In-text citation extraction
// ─────────────────────────────────────────────

interface ExtractedCitation {
  /** The full matched text, e.g. "(Smith, 2024)" or "[1]" */
  raw: string;
  /** Normalized key for matching against bibliography */
  key: string;
  /** Character offset in the body text */
  index: number;
}

/** APA: (Smith, 2024), (Smith & Jones, 2024), (Smith et al., 2024), (World Bank, 2023) */
const APA_PAREN = /\(([A-Z][A-Z]+|[A-Z][a-z]+)(?:\s+[a-z]+\.?)*(?:\s*(?:&|and)\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)*,?\s+(\d{4})\)/g;

/** APA narrative: Smith (2024), World Bank (2023), Smith et al. (2024) */
const APA_NARRATIVE = /\b(?:The\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?(?:\s+(?:and|&)\s+[A-Z][a-z]+)?(?:\s+et\s+al\.)?)\s+\((\d{4})\)/g;

/** MLA: (Smith 45), (Smith and Jones 112) */
const MLA = /\(([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)?)\s+(\d{1,4})\)/g;

/** Numbered: [1], [1, 3], [1-3] */
const NUMBERED = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;

/**
 * Extract all in-text citations from the body text.
 * Returns citations with normalized keys for matching.
 */
export function extractCitations(bodyText: string): ExtractedCitation[] {
  const citations: ExtractedCitation[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  // APA parenthetical: (Author, Year)
  while ((match = APA_PAREN.exec(bodyText)) !== null) {
    const raw = match[0];
    const author = extractFirstSurname(match[1]);
    const year = match[2];
    const key = `${author}:${year}`;
    const id = `${match.index}:${raw}`;
    if (!seen.has(id)) {
      seen.add(id);
      citations.push({ raw, key, index: match.index });
    }
  }

  // APA narrative: Author (Year)
  while ((match = APA_NARRATIVE.exec(bodyText)) !== null) {
    const raw = match[0];
    const author = extractFirstSurname(match[1]);
    const year = match[2];
    const key = `${author}:${year}`;
    const id = `${match.index}:${raw}`;
    if (!seen.has(id)) {
      seen.add(id);
      citations.push({ raw, key, index: match.index });
    }
  }

  // MLA: (Author Page)
  while ((match = MLA.exec(bodyText)) !== null) {
    const raw = match[0];
    const author = extractFirstSurname(match[1]);
    const key = `mla:${author}`;
    const id = `${match.index}:${raw}`;
    if (!seen.has(id)) {
      seen.add(id);
      citations.push({ raw, key, index: match.index });
    }
  }

  // Numbered: [1], [1, 3], [1-3]
  while ((match = NUMBERED.exec(bodyText)) !== null) {
    const raw = match[0];
    const nums = parseNumberList(match[1]);
    for (const n of nums) {
      const key = `num:${n}`;
      const id = `${match.index}:${key}`;
      if (!seen.has(id)) {
        seen.add(id);
        citations.push({ raw, key, index: match.index });
      }
    }
  }

  return citations;
}

/** Parse "1, 3" or "1-3" into [1, 2, 3] */
function parseNumberList(s: string): number[] {
  const nums: number[] = [];
  for (const part of s.split(/[,]/)) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end && i <= start + 20; i++) {
        nums.push(i);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

// ─────────────────────────────────────────────
// Bibliography entry parsing
// ─────────────────────────────────────────────

interface ParsedBibEntry {
  /** Normalized key for matching against citations */
  key: string;
  /** The raw text of this entry */
  rawText: string;
  /** Line index in the bibliography */
  index: number;
}

/**
 * Parse bibliography entries into normalized keys.
 * Key format: `firstauthor:year` (APA), `num:N` (numbered), `mla:author` (MLA).
 */
export function parseBibliographyEntries(bibliography: string): ParsedBibEntry[] {
  const lines = bibliography.split("\n").filter((l) => l.trim().length > 0);
  const entries: ParsedBibEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Numbered: [1] ... or 1. ...
    const numberedMatch = line.match(/^\[?(\d+)[.\]]\s+/);
    if (numberedMatch) {
      entries.push({
        key: `num:${numberedMatch[1]}`,
        rawText: line,
        index: i,
      });
      continue;
    }

    // APA: first word at line start = first author/org surname, year in parens later.
    // ^\s*([A-Z][A-Z]+|[A-Z][a-z]+) — first word only (org "IPCC" or surname "Smith")
    // \b.*?\(\s*(\d{4}) — skip everything until the year in parens.
    // "Smith, J., Brown, A. (2023)" → "Smith" + "2023" = smith:2023
    // "World Bank (2023)" → "World" + "2023" = world:2023
    // "IPCC (2023)" → "IPCC" + "2023" = ipcc:2023
    const apaMatch = line.match(/^\s*([A-Z][A-Z]+|[A-Z][a-z]+)\b.*?\(\s*(\d{4})\s*\)?/);
    if (apaMatch && /^\d{4}$/.test(apaMatch[2])) {
      const author = extractFirstSurname(apaMatch[1]);
      const year = apaMatch[2];
      entries.push({
        key: `${author}:${year}`,
        rawText: line,
        index: i,
      });
      continue;
    }

    // MLA fallback: Author, Title... (no year in parens)
    const mlaMatch = line.match(/^([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)?),/);
    if (mlaMatch) {
      entries.push({
        key: `mla:${mlaMatch[1].toLowerCase()}`,
        rawText: line,
        index: i,
      });
      continue;
    }

    // Fallback
    entries.push({
      key: `raw:${line.slice(0, 50).toLowerCase()}`,
      rawText: line,
      index: i,
    });
  }

  return entries;
}

// ─────────────────────────────────────────────
// Citation style consistency check
// ─────────────────────────────────────────────

interface StyleInfo {
  hasAPA: boolean;
  hasMLA: boolean;
  hasNumbered: boolean;
  styleCount: number;
  dominantStyle: string;
}

function detectCitationStyles(bodyText: string): StyleInfo {
  let apaCount = 0;
  let mlaCount = 0;
  let numberedCount = 0;

  let match: RegExpExecArray | null;

  const apaAll = /\(([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+|(?:\s+et\s+al\.))?),?\s+\d{4}\)/g;
  while ((match = apaAll.exec(bodyText)) !== null) apaCount++;

  const apaNarrative = /\b[A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+|(?:\s+et\s+al\.))?\s+\(\d{4}\)/g;
  while ((match = apaNarrative.exec(bodyText)) !== null) apaCount++;

  const mlaAll = /\(([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)?)\s+\d{1,4}\)/g;
  while ((match = mlaAll.exec(bodyText)) !== null) mlaCount++;

  const numAll = /\[\d+(?:\s*[-–,]\s*\d+)*\]/g;
  while ((match = numAll.exec(bodyText)) !== null) numberedCount++;

  const styles = [
    { name: "APA", count: apaCount },
    { name: "MLA", count: mlaCount },
    { name: "numbered", count: numberedCount },
  ].filter((s) => s.count > 0);

  const dominant = styles.sort((a, b) => b.count - a.count)[0];

  return {
    hasAPA: apaCount > 0,
    hasMLA: mlaCount > 0,
    hasNumbered: numberedCount > 0,
    styleCount: styles.length,
    dominantStyle: dominant?.name ?? "unknown",
  };
}

// ─────────────────────────────────────────────
// Main deterministic analysis
// ─────────────────────────────────────────────

/**
 * Run all deterministic checks on the body text + bibliography.
 * Returns findings with source "deterministic" and confidence 1.0.
 */
export function runDeterministicAnalysis(
  bodyText: string,
  bibliography: string | null
): Finding[] {
  const findings: Finding[] = [];
  const source = "deterministic" as const;
  const confidence = DEFAULT_CONFIDENCE.deterministic;

  const citations = extractCitations(bodyText);

  // ── Citation style consistency ──
  const styleInfo = detectCitationStyles(bodyText);
  if (styleInfo.styleCount > 1) {
    findings.push(createFinding({
      flaggedText: `Mixed citation styles detected (e.g. ${styleInfo.dominantStyle} and others)`,
      issue:
        "Your paper uses more than one citation style. Consistency within a single style " +
        "(APA, MLA, Chicago, etc.) is expected by most instructors.",
      suggestedFix:
        `Choose one citation style and apply it consistently. Your most-used style appears to be ${styleInfo.dominantStyle}. ` +
        "Convert all citations to match that style.",
      category: "structural-issue",
      source,
      confidence,
    }));
  }

  if (!bibliography) return findings;

  // ── Parse bibliography entries ──
  const bibEntries = parseBibliographyEntries(bibliography);

  // ── Match citations ↔ bibliography ──
  const citedKeys = new Set(citations.map((c) => c.key));
  const bibKeys = new Set(bibEntries.map((e) => e.key));

  // Citation orphans
  const orphanedCites = citations.filter((c) => !bibKeys.has(c.key));
  const seenKeys = new Set<string>();
  for (const cite of orphanedCites) {
    if (seenKeys.has(cite.key)) continue;
    seenKeys.add(cite.key);

    findings.push(createFinding({
      flaggedText: cite.raw,
      issue:
        `This in-text citation doesn't match any entry in your reference list. ` +
        `It may be a typo, a missing bibliography entry, or a formatting inconsistency.`,
      suggestedFix:
        `Check that "${cite.raw}" matches a reference in your bibliography. ` +
        `If it's correct, make sure the author name and year match exactly.`,
      category: "citation-orphan",
      source,
      confidence,
    }));
  }

  // Bibliography orphans
  const uncitedEntries = bibEntries.filter((e) => !citedKeys.has(e.key));
  for (const entry of uncitedEntries) {
    const shortPreview =
      entry.rawText.length > 80
        ? entry.rawText.slice(0, 80) + "..."
        : entry.rawText;

    findings.push(createFinding({
      flaggedText: shortPreview,
      issue:
        "This reference doesn't appear to be cited anywhere in your paper. " +
        "If you used it, add an in-text citation. If not, removing it keeps your reference list focused.",
      suggestedFix:
        "Add an in-text citation where you discuss this source, or remove it from your reference list if it wasn't used.",
      category: "bibliography-orphan",
      source,
      confidence,
    }));
  }

  return findings;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Extract just the first surname from an author string.
 * "Smith et al." → "smith"
 * "Chen and Williams" → "chen"
 * "Smith" → "smith"
 */
function extractFirstSurname(author: string): string {
  const firstWord = author.trim().split(/\s+/)[0];
  return firstWord.toLowerCase().replace(/[^a-z]/g, "");
}

function createFinding(params: {
  flaggedText: string;
  issue: string;
  suggestedFix: string;
  category: FindingCategory;
  source: "deterministic";
  confidence: number;
}): Finding {
  return {
    id: crypto.randomUUID(),
    flaggedText: params.flaggedText,
    issue: params.issue,
    suggestedFix: params.suggestedFix,
    category: params.category,
    severity: SEVERITY_MAP[params.category],
    confidence: params.confidence,
    source: params.source,
  };
}