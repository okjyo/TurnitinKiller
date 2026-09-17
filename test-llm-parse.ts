// ============================================================
// Tests for LLM response parsing and zero-citation edge cases.
// Run with: npx tsx test-llm-parse.ts
// ============================================================

import { runDeterministicAnalysis } from "./src/lib/analysis/deterministic";
import { mergeFindings } from "./src/lib/analysis/merge";
import type { RawLLMResponse } from "./src/lib/analysis/schema";

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

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ═════════════════════════════════════════════
// Zero-citation deterministic analysis
// ═════════════════════════════════════════════

console.log("\n── Zero-citation deterministic analysis ──");

const UNCITED_ESSAY = `Social media has fundamentally changed how people communicate in the modern world. Platforms like Instagram and TikTok have created new forms of expression that didn't exist a decade ago. Young people spend an average of three hours per day on social media, which has both positive and negative effects on mental health.

On the positive side, social media allows people to maintain connections across distances and find communities of shared interest. However, excessive use has been linked to increased anxiety and depression, particularly among adolescent girls. The constant comparison with idealized images creates unrealistic expectations and undermines self-esteem.

Schools and parents need to work together to promote healthy social media habits. Digital literacy programs should be integrated into school curricula to help young people critically evaluate online content.`;

test("uncited essay: deterministic returns 0 findings", () => {
  const findings = runDeterministicAnalysis(UNCITED_ESSAY, null);
  assert(findings.length === 0, `expected 0 findings for uncited essay, got ${findings.length}`);
});

// ═════════════════════════════════════════════
// Merge with empty deterministic + valid LLM
// ═════════════════════════════════════════════

console.log("\n── Merge: zero deterministic + LLM findings ──");

test("merge handles 0 deterministic + LLM findings correctly", () => {
  const llmResult: RawLLMResponse = {
    findings: [
      {
        flaggedText: "Young people spend an average of three hours per day on social media",
        issue: "This specific statistic would benefit from a citation to a research study or report so your reader can verify the claim.",
        suggestedFix: "Add a citation to a credible source, such as a Pew Research Center report or a peer-reviewed study on social media usage.",
        category: "citation-missing",
      },
      {
        flaggedText: "excessive use has been linked to increased anxiety and depression",
        issue: "This claim makes a health-related assertion without citing specific research. A citation would strengthen your argument significantly.",
        suggestedFix: "Reference a specific meta-analysis or longitudinal study that documents this link.",
        category: "citation-missing",
      },
    ],
    summary: "You raise important points about social media's impact on mental health. To strengthen your paper, consider adding citations to support your key claims — especially the statistics and health-related assertions.",
  };

  const report = mergeFindings([], llmResult, 1500);

  assert(report.findings.length === 2, `expected 2 findings, got ${report.findings.length}`);
  assert(report.summary.length > 0, "summary should not be empty");
  assert(report.meta.llmFindings === 2, `expected 2 LLM findings, got ${report.meta.llmFindings}`);
  assert(report.meta.deterministicFindings === 0, `expected 0 deterministic, got ${report.meta.deterministicFindings}`);
});

test("merge handles 0 deterministic + 0 LLM findings (perfect paper)", () => {
  const llmResult: RawLLMResponse = {
    findings: [],
    summary: "This is a well-cited, well-structured paper. Great work supporting your claims with evidence.",
  };

  const report = mergeFindings([], llmResult, 800);

  assert(report.findings.length === 0, `expected 0 findings, got ${report.findings.length}`);
  assert(report.summary.includes("well-cited"), "summary should mention quality");
});

// ═════════════════════════════════════════════
// Merge: realistic uncited essay scenario
// ═════════════════════════════════════════════

console.log("\n── Full pipeline: uncited essay (deterministic + LLM merge) ──");

test("uncited essay: full merge produces coherent report", () => {
  // Deterministic side: no citations → nothing to check
  const deterministicFindings = runDeterministicAnalysis(UNCITED_ESSAY, null);

  // LLM side: flags generic paragraphs and missing citations
  const llmResult: RawLLMResponse = {
    findings: [
      {
        flaggedText: "Young people spend an average of three hours per day on social media",
        issue: "This statistic needs a citation to a credible source.",
        suggestedFix: "Cite the Pew Research Center or a similar authority.",
        category: "citation-missing",
      },
      {
        flaggedText: "Schools and parents need to work together to promote healthy social media habits.",
        issue: "This paragraph makes broad recommendations without evidence or examples.",
        suggestedFix: "Add specific examples of successful digital literacy programs or cite research on their effectiveness.",
        category: "generic-paragraph",
      },
      {
        flaggedText: "(entire paper)",
        issue: "Your paper has no in-text citations or reference list. Academic writing requires you to credit the sources of your ideas and evidence.",
        suggestedFix: "Add a reference list and cite sources for all factual claims, statistics, and borrowed ideas.",
        category: "structural-issue",
      },
    ],
    summary: "You've chosen an important topic and organized your ideas clearly. To strengthen this paper for academic submission, you'll need to add citations throughout and include a reference list.",
  };

  const report = mergeFindings(deterministicFindings, llmResult, 2000);

  assert(report.findings.length === 3, `expected 3 findings, got ${report.findings.length}`);
  assert(
    report.findings.some((f) => f.category === "citation-missing"),
    "should have citation-missing finding"
  );
  assert(
    report.findings.some((f) => f.category === "structural-issue"),
    "should have structural-issue finding"
  );
  assert(
    report.findings.every((f) => f.id && f.severity && f.confidence && f.source),
    "all findings should have id, severity, confidence, source"
  );
  assert(
    report.findings.every((f) => f.source === "llm"),
    "all findings should be from LLM (deterministic has nothing for uncited text)"
  );
});

// ═════════════════════════════════════════════
// LLM response format edge cases
// ═════════════════════════════════════════════

console.log("\n── LLM response format edge cases ──");

test("merge handles LLM response with empty findings array", () => {
  const llmResult: RawLLMResponse = {
    findings: [],
    summary: "No issues found.",
  };
  const report = mergeFindings([], llmResult, 500);
  assert(report.findings.length === 0, `expected 0, got ${report.findings.length}`);
  assert(report.summary === "No issues found.", "summary preserved");
});

test("merge handles LLM response with structural-issue about missing references", () => {
  const llmResult: RawLLMResponse = {
    findings: [
      {
        flaggedText: "(entire paper)",
        issue: "No reference list found.",
        suggestedFix: "Add a References section.",
        category: "structural-issue",
      },
    ],
    summary: "Needs citations.",
  };
  const report = mergeFindings([], llmResult, 500);
  assert(report.findings.length === 1, `expected 1, got ${report.findings.length}`);
  assert(report.findings[0].category === "structural-issue", "category preserved");
});

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);