// ============================================================
// Tests for the deterministic analysis pipeline (Phase 1)
// Run with: npx tsx test-deterministic.ts
// ============================================================

import { extractCitations, parseBibliographyEntries, runDeterministicAnalysis } from "./src/lib/analysis/deterministic";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ─────────────────────────────────────────────
// extractCitations
// ─────────────────────────────────────────────

console.log("\n── extractCitations ──");

test("extracts APA parenthetical citations", () => {
  const text = "As shown by recent research (Smith, 2024), the effect is real.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
  assert(cites[0].raw === "(Smith, 2024)", `got ${cites[0].raw}`);
  assert(cites[0].key === "smith:2024", `got ${cites[0].key}`);
});

test("extracts APA with multiple authors", () => {
  const text = "Studies show (Smith and Jones, 2023) that this works.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
  assert(cites[0].key.includes("smith"), "should normalize author");
});

test("extracts APA et al.", () => {
  const text = "According to (Smith et al., 2022), the results are clear.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
  assert(cites[0].key === "smithetal:2022", `got ${cites[0].key}`);
});

test("extracts APA narrative citations", () => {
  const text = "Smith (2024) demonstrated that the effect persists.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
  assert(cites[0].key === "smith:2024", `got ${cites[0].key}`);
});

test("extracts numbered citations", () => {
  const text = "Recent work [1] confirms this. Also see [3, 5] and [10-12].";
  const cites = extractCitations(text);
  assert(cites.length >= 5, `expected >= 5, got ${cites.length}`);
  const keys = cites.map((c) => c.key);
  assert(keys.includes("num:1"), "should have num:1");
  assert(keys.includes("num:3"), "should have num:3");
  assert(keys.includes("num:5"), "should have num:5");
  assert(keys.includes("num:10"), "should have num:10");
  assert(keys.includes("num:12"), "should have num:12");
});

test("extracts MLA citations", () => {
  const text = "The effect is documented (Smith 45) across studies.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
  assert(cites[0].key.startsWith("mla:"), `got ${cites[0].key}`);
});

test("handles no citations", () => {
  const text = "This paragraph has no citations at all.";
  const cites = extractCitations(text);
  assert(cites.length === 0, `expected 0, got ${cites.length}`);
});

test("deduplicates same citation at same position", () => {
  const text = "(Smith, 2024) is important.";
  const cites = extractCitations(text);
  assert(cites.length === 1, `expected 1, got ${cites.length}`);
});

// ─────────────────────────────────────────────
// parseBibliographyEntries
// ─────────────────────────────────────────────

console.log("\n── parseBibliographyEntries ──");

test("parses APA bibliography entries", () => {
  const bib =
    "Smith, J. (2024). Title of the article. Journal Name, 12(3), 45-67.\n" +
    "Doe, A. (2023). Another title. Another Journal, 5(1), 100-120.";
  const entries = parseBibliographyEntries(bib);
  assert(entries.length === 2, `expected 2, got ${entries.length}`);
  assert(entries[0].key === "smith:2024", `got ${entries[0].key}`);
  assert(entries[1].key === "doe:2023", `got ${entries[1].key}`);
});

test("parses numbered bibliography entries", () => {
  const bib = "[1] First reference\n[2] Second reference";
  const entries = parseBibliographyEntries(bib);
  assert(entries.length === 2, `expected 2, got ${entries.length}`);
  assert(entries[0].key === "num:1", `got ${entries[0].key}`);
  assert(entries[1].key === "num:2", `got ${entries[1].key}`);
});

test("parses organization entries", () => {
  const bib = "IPCC (2023). Climate Change 2023: Synthesis Report.";
  const entries = parseBibliographyEntries(bib);
  assert(entries.length === 1, `expected 1, got ${entries.length}`);
  assert(entries[0].key === "ipcc:2023", `got ${entries[0].key}`);
});

test("skips blank lines", () => {
  const bib = "Smith, J. (2024). Title.\n\n\nDoe, A. (2023). Title.";
  const entries = parseBibliographyEntries(bib);
  assert(entries.length === 2, `expected 2, got ${entries.length}`);
});

// ─────────────────────────────────────────────
// runDeterministicAnalysis
// ─────────────────────────────────────────────

console.log("\n── runDeterministicAnalysis ──");

test("detects citation orphans", () => {
  const body = "According to (Smith, 2024), the effect is real. But (Jones, 2023) is not in the bibliography.";
  const bib = "Smith, J. (2024). Title. Journal.";
  const findings = runDeterministicAnalysis(body, bib);
  const orphanFindings = findings.filter((f) => f.category === "citation-orphan");
  assert(orphanFindings.length >= 1, `expected >= 1 orphan, got ${orphanFindings.length}`);
  assert(
    orphanFindings[0].flaggedText.includes("Jones"),
    `should flag Jones, got ${orphanFindings[0].flaggedText}`
  );
  assert(orphanFindings[0].confidence === 1.0, "should have confidence 1.0");
  assert(orphanFindings[0].source === "deterministic", "should be deterministic");
});

test("detects bibliography orphans", () => {
  const body = "According to (Smith, 2024), the effect is real.";
  const bib =
    "Smith, J. (2024). Title. Journal.\n" +
    "Doe, A. (2023). Unused Reference. Another Journal.";
  const findings = runDeterministicAnalysis(body, bib);
  const bibOrphans = findings.filter((f) => f.category === "bibliography-orphan");
  assert(bibOrphans.length >= 1, `expected >= 1 bib orphan, got ${bibOrphans.length}`);
  assert(
    bibOrphans[0].flaggedText.includes("Doe") || bibOrphans[0].flaggedText.includes("Unused"),
    `should flag Doe/Unused, got ${bibOrphans[0].flaggedText}`
  );
});

test("detects mixed citation styles", () => {
  const body = "As shown (Smith, 2024) and also [1], the results are mixed.";
  const findings = runDeterministicAnalysis(body, null);
  const styleFindings = findings.filter((f) => f.category === "structural-issue");
  assert(styleFindings.length >= 1, `expected >= 1 style issue, got ${styleFindings.length}`);
});

test("returns no findings when everything matches", () => {
  const body = "According to (Smith, 2024), the effect is real. (Jones, 2023) also supports this.";
  const bib =
    "Smith, J. (2024). Title. Journal.\n" +
    "Jones, A. (2023). Another. Journal.";
  const findings = runDeterministicAnalysis(body, bib);
  assert(findings.length === 0, `expected 0 findings, got ${findings.length}`);
});

test("returns empty when no citations and no bibliography", () => {
  const body = "This paragraph has no citations at all. It just discusses the topic.";
  const findings = runDeterministicAnalysis(body, null);
  assert(findings.length === 0, `expected 0 findings, got ${findings.length}`);
});

test("all findings have required fields", () => {
  const body = "(Smith, 2024) says something. (Jones, 2023) is not in bib.";
  const bib = "Smith, J. (2024). Title. Journal.";
  const findings = runDeterministicAnalysis(body, bib);
  for (const f of findings) {
    assert(typeof f.id === "string" && f.id.length > 0, "should have id");
    assert(typeof f.flaggedText === "string" && f.flaggedText.length > 0, "should have flaggedText");
    assert(typeof f.issue === "string" && f.issue.length > 0, "should have issue");
    assert(typeof f.suggestedFix === "string" && f.suggestedFix.length > 0, "should have suggestedFix");
    assert(typeof f.severity === "string", "should have severity");
    assert(typeof f.confidence === "number", "should have confidence");
    assert(f.source === "deterministic", "should be deterministic");
  }
});

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);