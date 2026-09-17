// ============================================================
// Realistic assignment tests for the full analysis pipeline.
// Tests deterministic analysis with academic paper excerpts.
// Run with: npx tsx test-realistic.ts
//
// Note: LLM analysis (Phase 2) requires a live API key and is
// tested via the running app. These tests cover the deterministic
// pipeline (Phase 1) and merge logic (Phase 3) with realistic data.
// ============================================================

import { extractCitations, parseBibliographyEntries, runDeterministicAnalysis } from "./src/lib/analysis/deterministic";
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

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ═════════════════════════════════════════════
// SCENARIO 1: Well-cited APA psychology paper
// Should produce 0 deterministic findings
// ═════════════════════════════════════════════

console.log("\n══ Scenario 1: Well-cited APA psychology paper ══");

const PAPER_1_BODY = `The relationship between sleep quality and academic performance has been extensively studied in recent years. Research by Smith et al. (2023) found that students who averaged fewer than six hours of sleep per night scored significantly lower on standardized assessments. This finding is consistent with earlier work by Chen and Williams (2021), who demonstrated a dose-response relationship between sleep duration and GPA.

Curley et al. (2022) expanded on this research by examining the mediating role of attention. Using a sample of 1,200 undergraduate students, they found that sustained attention mediated approximately 40% of the relationship between sleep quality and academic performance. These results suggest that interventions targeting attention may partially buffer against the negative effects of poor sleep.

However, not all studies have found consistent results. Patel (2024) argued that the relationship is confounded by socioeconomic factors, noting that students from lower-income backgrounds tend to both sleep less and perform worse academically. When controlling for household income and parental education, the effect size was reduced by approximately 60%.

The present study aims to address these methodological concerns by using a longitudinal design with within-subject comparisons. By tracking the same students across two academic semesters, we can control for stable individual differences that may confound cross-sectional designs.`;

const PAPER_1_BIB = `Chen, L., & Williams, R. (2021). Sleep duration and GPA: A dose-response analysis. Journal of College Student Development, 62(4), 412-428.

Curley, T., Martinez, K., & O'Brien, S. (2022). The mediating role of attention in the sleep-performance relationship. Sleep Medicine Reviews, 58, 101-115.

Patel, N. (2024). Socioeconomic confounders in sleep and academic performance research. Educational Psychology Review, 36(1), 78-95.

Smith, J., Brown, A., & Lee, S. (2023). Sleep quality and academic outcomes: A meta-analysis. Psychological Bulletin, 149(3), 234-256.`;

test("well-cited paper: no citation orphans", () => {
  const findings = runDeterministicAnalysis(PAPER_1_BODY, PAPER_1_BIB);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  assert(orphans.length === 0, `expected 0 orphans, got ${orphans.length}: ${orphans.map(f=>f.flaggedText).join(", ")}`);
});

test("well-cited paper: no bibliography orphans", () => {
  const findings = runDeterministicAnalysis(PAPER_1_BODY, PAPER_1_BIB);
  const bibOrphans = findings.filter((f) => f.category === "bibliography-orphan");
  assert(bibOrphans.length === 0, `expected 0 bib orphans, got ${bibOrphans.length}: ${bibOrphans.map(f=>f.flaggedText).join(", ")}`);
});

test("well-cited paper: no style issues", () => {
  const findings = runDeterministicAnalysis(PAPER_1_BODY, PAPER_1_BIB);
  const styleIssues = findings.filter((f) => f.category === "structural-issue");
  assert(styleIssues.length === 0, `expected 0 style issues, got ${styleIssues.length}`);
});

test("well-cited paper: total deterministic findings is 0", () => {
  const findings = runDeterministicAnalysis(PAPER_1_BODY, PAPER_1_BIB);
  assert(findings.length === 0, `expected 0 total findings, got ${findings.length}`);
});

// ═════════════════════════════════════════════
// SCENARIO 2: Paper with citation orphans
// References that don't appear in the bibliography
// ═════════════════════════════════════════════

console.log("\n══ Scenario 2: Paper with citation orphans ══");

const PAPER_2_BODY = `Climate change poses significant risks to global food security. According to the Intergovernmental Panel on Climate Change (IPCC, 2023), crop yields in tropical regions could decline by up to 25% by 2050 under moderate warming scenarios. Thompson and Garcia (2022) found similar projections for wheat production in South Asia.

More recent work by Nakamura et al. (2024) suggests that adaptation strategies could offset some of these losses, particularly through drought-resistant crop varieties. However, Anderson (2021) cautioned that technological solutions alone are insufficient without addressing systemic inequities in food distribution.

The economic implications are substantial. A World Bank report estimated that climate-related crop failures could push an additional 100 million people into poverty by 2030 (World Bank, 2023).`;

const PAPER_2_BIB = `IPCC. (2023). Climate Change 2023: Synthesis Report. Intergovernmental Panel on Climate Change.

Nakamura, Y., Lee, H., & Singh, R. (2024). Adaptation strategies for climate-resilient agriculture. Nature Food, 5(2), 89-102.

Thompson, K., & Garcia, M. (2022). Climate impacts on South Asian wheat production. Agricultural Systems, 195, 103-118.`;

test("orphan: Anderson (2021) not in bibliography", () => {
  const findings = runDeterministicAnalysis(PAPER_2_BODY, PAPER_2_BIB);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  const anderson = orphans.find((f) => f.flaggedText.includes("Anderson"));
  assert(anderson !== undefined, `should flag Anderson (2021), got: ${orphans.map(f=>f.flaggedText).join(", ")}`);
  assert(anderson!.confidence === 1.0, "should have confidence 1.0");
});

test("orphan: World Bank (2023) not in bibliography", () => {
  const findings = runDeterministicAnalysis(PAPER_2_BODY, PAPER_2_BIB);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  const worldBank = orphans.find((f) => f.flaggedText.includes("World Bank"));
  assert(worldBank !== undefined, `should flag World Bank (2023), got: ${orphans.map(f=>f.flaggedText).join(", ")}`);
});

test("no bibliography orphans (all bib entries are cited)", () => {
  const findings = runDeterministicAnalysis(PAPER_2_BODY, PAPER_2_BIB);
  const bibOrphans = findings.filter((f) => f.category === "bibliography-orphan");
  assert(bibOrphans.length === 0, `expected 0 bib orphans, got ${bibOrphans.length}`);
});

// ═════════════════════════════════════════════
// SCENARIO 3: Paper with bibliography orphans
// References in bibliography never cited in body
// ═════════════════════════════════════════════

console.log("\n══ Scenario 3: Paper with bibliography orphans ══");

const PAPER_3_BODY = `Artificial intelligence is transforming healthcare diagnostics. Smith and Patel (2023) demonstrated that convolutional neural networks achieve radiologist-level accuracy in detecting lung nodules from chest CT scans. Their model was trained on over 50,000 annotated images from three major hospitals.

Building on this work, Chen (2024) extended the approach to mammography screening, achieving a 15% reduction in false positives compared to traditional double-reading protocols. These results suggest that AI-assisted screening could significantly reduce unnecessary biopsies.`;

const PAPER_3_BIB = `Chen, W. (2024). AI-assisted mammography screening. The Lancet Digital Health, 6(1), e45-e52.

Johnson, R., Kim, S., & Park, J. (2021). Ethical considerations in clinical AI deployment. Journal of Medical Ethics, 47(8), 567-574.

Lee, M. (2022). Regulatory frameworks for medical AI devices. Health Affairs, 41(3), 412-420.

Smith, A., & Patel, R. (2023). Deep learning for lung nodule detection. Radiology, 307(2), e221845.

Williams, T. (2020). The history of AI in medicine. Annual Review of Medicine, 71, 389-403.`;

test("bibliography orphans: Johnson, Lee, Williams never cited", () => {
  const findings = runDeterministicAnalysis(PAPER_3_BODY, PAPER_3_BIB);
  const bibOrphans = findings.filter((f) => f.category === "bibliography-orphan");
  assert(bibOrphans.length === 3, `expected 3 bib orphans, got ${bibOrphans.length}: ${bibOrphans.map(f=>f.flaggedText.slice(0,40)).join("; ")}`);
  const texts = bibOrphans.map((f) => f.flaggedText);
  assert(texts.some((t) => t.includes("Johnson")), "should flag Johnson");
  assert(texts.some((t) => t.includes("Lee")), "should flag Lee");
  assert(texts.some((t) => t.includes("Williams")), "should flag Williams");
});

test("no citation orphans (all cites have bib entries)", () => {
  const findings = runDeterministicAnalysis(PAPER_3_BODY, PAPER_3_BIB);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  assert(orphans.length === 0, `expected 0 citation orphans, got ${orphans.length}`);
});

// ═════════════════════════════════════════════
// SCENARIO 4: Mixed citation styles (APA + numbered)
// ═════════════════════════════════════════════

console.log("\n══ Scenario 4: Mixed citation styles ══");

const PAPER_4_BODY = `Renewable energy adoption has accelerated globally. According to recent data (IEA, 2024), solar capacity grew by 50% in 2023 alone. Studies have shown that policy incentives are the primary driver [1], with feed-in tariffs proving most effective [3, 7]. However, grid integration remains a challenge (Williams and Park, 2023).

The cost of solar panels has decreased by 90% since 2010 [4], making it the cheapest source of electricity in many regions. Subsidies and tax credits have been essential to this decline (Brown, 2022).`;

test("mixed styles detected (APA + numbered)", () => {
  const findings = runDeterministicAnalysis(PAPER_4_BODY, null);
  const styleIssues = findings.filter((f) => f.category === "structural-issue");
  assert(styleIssues.length >= 1, `expected >= 1 style issue, got ${styleIssues.length}`);
  assert(
    styleIssues[0].issue.toLowerCase().includes("style") || styleIssues[0].issue.toLowerCase().includes("citation"),
    `should mention citation style, got: ${styleIssues[0].issue.slice(0, 80)}`
  );
});

// ═════════════════════════════════════════════
// SCENARIO 5: No citations at all
// ═════════════════════════════════════════════

console.log("\n══ Scenario 5: No citations at all ══");

const PAPER_5_BODY = `Social media has fundamentally changed how people communicate. Platforms like Instagram and TikTok have created new forms of expression that didn't exist a decade ago. Young people spend an average of three hours per day on social media, which has both positive and negative effects on mental health.

On the positive side, social media allows people to maintain connections across distances and find communities of shared interest. However, excessive use has been linked to increased anxiety and depression, particularly among adolescent girls. The constant comparison with idealized images creates unrealistic expectations and undermines self-esteem.

Schools and parents need to work together to promote healthy social media habits. Digital literacy programs should be integrated into school curricula to help young people critically evaluate online content.`;

test("no citations + no bibliography = no deterministic findings", () => {
  const findings = runDeterministicAnalysis(PAPER_5_BODY, null);
  // No citations means nothing to check deterministically
  // (LLM would flag the missing citations in Phase 2)
  assert(findings.length === 0, `expected 0 findings (no citations to match), got ${findings.length}`);
});

// ═════════════════════════════════════════════
// SCENARIO 6: Numbered references (IEEE/engineering style)
// ═════════════════════════════════════════════

console.log("\n══ Scenario 6: Numbered references (IEEE style) ══");

const PAPER_6_BODY = `Deep learning models have achieved state-of-the-art performance in natural language processing [1]. The transformer architecture [2] revolutionized the field by introducing self-attention mechanisms that capture long-range dependencies more effectively than recurrent approaches.

Recent work has focused on scaling these models to unprecedented sizes [3, 5]. Brown et al. demonstrated that language models exhibit emergent abilities at certain parameter thresholds [4]. However, the computational cost of training such models raises concerns about environmental impact and accessibility [6].

Techniques such as knowledge distillation [7] and pruning [8] offer promising avenues for creating more efficient models without significant performance degradation.`;

const PAPER_6_BIB = `[1] A. Vaswani et al., "Attention is all you need," in Advances in Neural Information Processing Systems, vol. 30, 2017.
[2] J. Devlin et al., "BERT: Pre-training of deep bidirectional transformers," in Proc. NAACL-HLT, 2019, pp. 4171-4186.
[3] T. Brown et al., "Language models are few-shot learners," in Advances in Neural Information Processing Systems, vol. 33, 2020, pp. 1877-1901.
[4] J. Wei et al., "Emergent abilities of large language models," in Proc. NeurIPS, 2022.
[5] A. Chowdhery et al., "PaLM: Scaling language modeling with pathways," Journal of Machine Learning Research, vol. 24, no. 240, pp. 1-113, 2023.
[6] E. Strubell et al., "Energy and policy considerations for deep learning in NLP," in Proc. ACL, 2019, pp. 3645-3650.
[7] G. Hinton et al., "Distilling the knowledge in a neural network," in Proc. NeurIPS Workshop, 2015.
[8] S. Han et al., "Learning both weights and connections for efficient neural networks," in Proc. NeurIPS, 2015, pp. 1135-1143.`;

test("numbered refs: all citations match bibliography", () => {
  const findings = runDeterministicAnalysis(PAPER_6_BODY, PAPER_6_BIB);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  assert(orphans.length === 0, `expected 0 citation orphans, got ${orphans.length}: ${orphans.map(f=>f.flaggedText).join(", ")}`);
});

test("numbered refs: no bibliography orphans", () => {
  const findings = runDeterministicAnalysis(PAPER_6_BODY, PAPER_6_BIB);
  const bibOrphans = findings.filter((f) => f.category === "bibliography-orphan");
  assert(bibOrphans.length === 0, `expected 0 bib orphans, got ${bibOrphans.length}`);
});

// ═════════════════════════════════════════════
// SCENARIO 7: Edge case — citation inside a quote
// Citation should still be detected
// ═════════════════════════════════════════════

console.log("\n══ Scenario 7: Edge cases ══");

test("citation inside a quoted passage is still detected", () => {
  const body = `As the authors noted, "the effect was statistically significant (p < .001; Smith, 2024) across all subgroups."`;
  const bib = "Smith, J. (2024). Title. Journal.";
  const findings = runDeterministicAnalysis(body, bib);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  assert(orphans.length === 0, "Smith (2024) is in the bib — should not be flagged");
});

test("author name in running text does not count as citation", () => {
  const body = "Smith argues that the effect is real. However, the data does not support this claim.";
  const findings = runDeterministicAnalysis(body, null);
  // No parenthetical citation or narrative citation — should extract nothing
  const cites = extractCitations(body);
  assert(cites.length === 0, `expected 0 citations (no year), got ${cites.length}`);
});

test("partial year match does not create false positive", () => {
  const body = "In 2024, the government announced new policy (Jones, 2023).";
  const bib = "Jones, A. (2023). Policy Analysis. Government Review.";
  const findings = runDeterministicAnalysis(body, bib);
  const orphans = findings.filter((f) => f.category === "citation-orphan");
  assert(orphans.length === 0, "Jones (2023) is in bib — should not be flagged");
});

test("auto-detected bibliography structural finding merges correctly", () => {
  const body = "According to (Smith, 2024), the effect is real.";
  const bib = "Smith, J. (2024). Title. Journal.";

  const detFindings = runDeterministicAnalysis(body, bib);

  // Simulate what the API route does for auto-detected bibliography
  const autoBibFinding = {
    id: crypto.randomUUID(),
    flaggedText: "(Reference list detected automatically)",
    issue: "We found a reference list in your paper.",
    suggestedFix: "Verify that the reference list was correctly identified.",
    category: "structural-issue" as const,
    severity: "low" as const,
    confidence: 1.0,
    source: "deterministic" as const,
  };

  // Simulate empty LLM result (just summary, no findings)
  const llmResult: RawLLMResponse = {
    findings: [],
    summary: "Analysis complete.",
  };

  const merged = mergeFindings(
    [autoBibFinding, ...detFindings],
    llmResult,
    1500
  );

  assert(merged.findings.length === 1, `expected 1 finding (auto-bib), got ${merged.findings.length}`);
  assert(merged.meta.deterministicFindings === 1, "should count deterministic");
  assert(merged.meta.llmFindings === 0, "should count LLM");
  assert(merged.summary === "Analysis complete.", "should preserve LLM summary");
});

// ═════════════════════════════════════════════
// SCENARIO 8: Merge with overlapping LLM + deterministic findings
// ═════════════════════════════════════════════

console.log("\n══ Scenario 8: Merge deduplication ══");

test("merge deduplicates LLM finding that overlaps with deterministic", () => {
  const body = "(Smith, 2024) is important. (Jones, 2023) is not in the bibliography.";
  const bib = "Smith, J. (2024). Title. Journal.";

  const detFindings = runDeterministicAnalysis(body, bib);
  assert(detFindings.length >= 1, "should have at least 1 deterministic finding");

  // Simulate LLM also flagging Jones (2023) — should be deduped
  const llmResult: RawLLMResponse = {
    findings: [
      {
        flaggedText: "(Jones, 2023)",  // overlaps with deterministic finding
        issue: "This citation doesn't appear in your reference list.",
        suggestedFix: "Add the full reference or remove the citation.",
        category: "citation-orphan",
      },
      {
        flaggedText: "The paper discusses the topic without specific evidence.",
        issue: "This paragraph could use more supporting data.",
        suggestedFix: "Add specific statistics or examples.",
        category: "generic-paragraph",
      },
    ],
    summary: "Good start, but some areas need strengthening.",
  };

  const merged = mergeFindings(detFindings, llmResult, 2000);

  // The Jones citation-orphan from LLM should be deduped (deterministic already flagged it)
  const jonesFindings = merged.findings.filter((f) =>
    f.flaggedText.includes("Jones") && f.category === "citation-orphan"
  );
  assert(jonesFindings.length === 1, `expected exactly 1 Jones finding, got ${jonesFindings.length}`);
  assert(jonesFindings[0].source === "deterministic", "should keep the deterministic version");

  // The generic-paragraph from LLM should be kept (no overlap)
  const genericFindings = merged.findings.filter((f) => f.category === "generic-paragraph");
  assert(genericFindings.length === 1, `expected 1 generic-paragraph, got ${genericFindings.length}`);
  assert(genericFindings[0].source === "llm", "should be from LLM");
});

// ═════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
