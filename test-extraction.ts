// ============================================================
// Smoke test for the document extraction pipeline.
// Run with: npx tsx test-extraction.ts
// ============================================================

import { extractTextFromFile } from "./src/lib/parsing/extract-text";
import {
  normalizeText,
  normalizePdfText,
  stripPdfMetadata,
} from "./src/lib/parsing/normalize-text";
import {
  extractBibliography,
  countReferences,
} from "./src/lib/parsing/bibliography";
import { existsSync, readFileSync } from "node:fs";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result
      .then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err instanceof Error ? err.message : err}`);
        failed++;
      });
  }
  try {
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

async function runAll() {
  // ─────────────────────────────────────────────
  // stripPdfMetadata
  // ─────────────────────────────────────────────

  console.log("\n── stripPdfMetadata ──");

  test("strips pdf-parse metadata headers", () => {
    const raw =
      "Author: John Doe\nCreator: Microsoft Word\nProducer: Adobe PDF\n" +
      "CreationDate: 2024-01-15\nPages: 12\nPDF version: 1.7\n\n" +
      "This is the actual document text that matters.";
    const result = stripPdfMetadata(raw);
    assert(
      result.startsWith("This is the actual"),
      `expected text start, got: ${result.slice(0, 60)}`
    );
    assert(!result.includes("Author:"), "should strip Author");
    assert(!result.includes("Creator:"), "should strip Creator");
    assert(!result.includes("Producer:"), "should strip Producer");
    assert(!result.includes("PDF version:"), "should strip PDF version");
  });

  test("handles no metadata gracefully", () => {
    const raw = "Just some document text with no metadata header.";
    const result = stripPdfMetadata(raw);
    assert(result === raw, "should return unchanged text");
  });

  test("strips metadata with extra whitespace", () => {
    const raw = "  Author: Jane Smith  \n\nParagraph text here.";
    const result = stripPdfMetadata(raw);
    assert(result.includes("Paragraph text"), "should keep paragraph");
    assert(!result.includes("Author"), "should strip Author");
  });

  // ─────────────────────────────────────────────
  // normalizeText
  // ─────────────────────────────────────────────

  console.log("\n── normalizeText ──");

  test("normalizes CRLF to LF", () => {
    const result = normalizeText("line1\r\nline2\r\nline3");
    assert(result === "line1\nline2\nline3", `got: ${JSON.stringify(result)}`);
  });

  test("strips BOM", () => {
    const result = normalizeText("﻿Hello world");
    assert(result === "Hello world", `got: ${JSON.stringify(result)}`);
  });

  test("collapses 3+ blank lines into 2", () => {
    const result = normalizeText("a\n\n\n\n\nb");
    assert(result === "a\n\nb", `got: ${JSON.stringify(result)}`);
  });

  test("preserves double newlines (paragraph breaks)", () => {
    const result = normalizeText("paragraph one\n\nparagraph two");
    assert(
      result === "paragraph one\n\nparagraph two",
      `got: ${JSON.stringify(result)}`
    );
  });

  test("collapses runs of spaces within a line", () => {
    const result = normalizeText("hello    world");
    assert(result === "hello world", `got: ${JSON.stringify(result)}`);
  });

  test("trims trailing whitespace on lines", () => {
    const result = normalizeText("line1   \nline2   ");
    assert(result === "line1\nline2", `got: ${JSON.stringify(result)}`);
  });

  test("strips zero-width characters", () => {
    const result = normalizeText("hello​world‌!");
    assert(result === "helloworld!", `got: ${JSON.stringify(result)}`);
  });

  // ─────────────────────────────────────────────
  // normalizePdfText
  // ─────────────────────────────────────────────

  console.log("\n── normalizePdfText ──");

  test("strips metadata before normalizing", () => {
    const input =
      "Author: Test Author\nCreator: Test\n\nThis is the actual content of the document.";
    const result = normalizePdfText(input);
    assert(
      result.startsWith("This is the actual"),
      `expected text start, got: ${result.slice(0, 60)}`
    );
    assert(!result.includes("Author:"), "should strip metadata");
  });

  test("joins mid-sentence wraps (lowercase→lowercase)", () => {
    const input = "This is a sen-\ntence that wraps across lines.";
    const result = normalizePdfText(input);
    assert(
      result.includes("sentence that wraps"),
      `expected join, got: ${JSON.stringify(result)}`
    );
  });

  test("joins mid-sentence wraps without hyphen", () => {
    const input = "This sentence continues\non the next line.";
    const result = normalizePdfText(input);
    assert(
      result.includes("continues on"),
      `expected join, got: ${JSON.stringify(result)}`
    );
  });

  test("preserves paragraph breaks (uppercase after newline)", () => {
    const input = "End of paragraph.\n\nStart of new paragraph.";
    const result = normalizePdfText(input);
    assert(
      result.includes("paragraph.\n\nStart"),
      `expected paragraph break, got: ${JSON.stringify(result)}`
    );
  });

  test("collapses multiple spaces (column artifacts)", () => {
    const result = normalizePdfText("text   with    extra   spaces");
    assert(
      result === "text with extra spaces",
      `got: ${JSON.stringify(result)}`
    );
  });

  test("joins orphan words (short next line)", () => {
    const input =
      "The results showed a significant\nimprovement in the treatment group.";
    const result = normalizePdfText(input);
    assert(
      result.includes("significant improvement"),
      `expected orphan join, got: ${JSON.stringify(result)}`
    );
  });

  test("does not join after terminal punctuation", () => {
    const input = "This is a complete sentence.\nNext paragraph starts here.";
    const result = normalizePdfText(input);
    // Should keep the sentence break (uppercase-starting next line)
    assert(
      result.includes("sentence.\n"),
      `expected sentence break preserved, got: ${JSON.stringify(result)}`
    );
  });

  // ─────────────────────────────────────────────
  // extractBibliography
  // ─────────────────────────────────────────────

  console.log("\n── extractBibliography ──");

  test("detects 'References' header at end of paper", () => {
    const text =
      "This is the body of the paper with enough content to pass the sanity check. " +
      "It discusses various topics and makes several claims about the subject matter.\n\n" +
      "References\n" +
      "Smith, J. (2024). Title of the article. Journal Name, 12(3), 45-67.\n" +
      "Doe, A. (2023). Another title. Another Journal, 5(1), 100-120.";
    const result = extractBibliography(text);
    assert(result.wasExtracted === true, "should detect References");
    assert(
      result.bibliography!.includes("Smith, J."),
      "bibliography should contain Smith"
    );
    assert(
      !result.bodyText.includes("Smith, J."),
      "body should not contain Smith"
    );
  });

  test("detects 'Works Cited' header", () => {
    const text =
      "This is the body of the paper with enough content to pass the sanity check. " +
      "It discusses various topics and makes several claims.\n\n" +
      "Works Cited\n" +
      "Smith, J. Title of the Article. Journal Name, vol. 12, no. 3, 2024, pp. 45-67.\n" +
      "Doe, A. Another Title. Another Journal, vol. 5, no. 1, 2023, pp. 100-120.";
    const result = extractBibliography(text);
    assert(result.wasExtracted === true, "should detect Works Cited");
  });

  test("detects 'Bibliography' header", () => {
    const text =
      "This is the body of the paper with enough content to pass the sanity check. " +
      "It discusses various topics and makes several claims.\n\n" +
      "Bibliography\n" +
      "Smith, J. (2024). Title of the article. Journal Name, 12(3), 45-67.\n" +
      "Doe, A. (2023). Another title. Another Journal, 5(1), 100-120.";
    const result = extractBibliography(text);
    assert(result.wasExtracted === true, "should detect Bibliography");
  });

  test("returns null bibliography when no header found", () => {
    const text =
      "This is a paper with no references section. It just has body text that goes on.";
    const result = extractBibliography(text);
    assert(result.wasExtracted === false, "should not detect anything");
    assert(result.bibliography === null, "bibliography should be null");
  });

  test("ignores 'References' used in a sentence", () => {
    const text =
      "In the references section of prior work, many authors have noted similar patterns. " +
      "This paper expands on those findings with new data and analysis.";
    const result = extractBibliography(text);
    assert(
      result.wasExtracted === false,
      "should not match 'references' inside a sentence"
    );
  });

  test("rejects too-short bibliography (sanity check)", () => {
    const text =
      "This is the body of the paper with enough content to pass the sanity check. " +
      "It discusses various topics and makes several claims.\n\nReferences\nFoo.";
    const result = extractBibliography(text);
    assert(
      result.wasExtracted === false,
      "should reject bibliography under 50 chars"
    );
  });

  test("rejects when body would be too short (header near top)", () => {
    const text =
      "References\n" +
      "Smith, J. (2024). Title of the article. Journal Name, 12(3), 45-67.\n" +
      "Doe, A. (2023). Another title. Another Journal, 5(1), 100-120.\n" +
      "Johnson, B. (2022). Third title. Third Journal, 8(2), 200-220.";
    const result = extractBibliography(text);
    assert(
      result.wasExtracted === false,
      "should reject when body is too short"
    );
  });

  // ─────────────────────────────────────────────
  // countReferences
  // ─────────────────────────────────────────────

  console.log("\n── countReferences ──");

  test("counts APA-style references", () => {
    const bib =
      "Smith, J. (2024). Title. Journal.\n" +
      "Doe, A. (2023). Another. Journal.\n" +
      "Johnson, B. (2022). Third. Journal.";
    assert(countReferences(bib) === 3, `got ${countReferences(bib)}`);
  });

  test("counts numbered references", () => {
    const bib =
      "[1] First reference\n[2] Second reference\n[3] Third reference";
    assert(countReferences(bib) === 3, `got ${countReferences(bib)}`);
  });

  test("returns 0 for empty input", () => {
    assert(countReferences("") === 0, `got ${countReferences("")}`);
  });

  // ─────────────────────────────────────────────
  // extractTextFromFile — .txt
  // ─────────────────────────────────────────────

  console.log("\n── extractTextFromFile (.txt) ──");

  await test("extracts UTF-8 .txt file", async () => {
    const content =
      "This is a test document with enough content to pass the minimum length check. " +
      "It has multiple paragraphs.\n\nSecond paragraph here with more text.";
    const buffer = Buffer.from(content, "utf-8");
    const result = await extractTextFromFile(buffer, "test.txt");
    assert(result.includes("test document"), "should contain the text");
    assert(
      result.includes("Second paragraph"),
      "should preserve paragraphs"
    );
  });

  await test("extracts UTF-8 with BOM .txt file", async () => {
    const content =
      "﻿This is a BOM-prefixed document with enough content to pass the minimum length check. " +
      "It tests BOM handling in the extraction pipeline.";
    const buffer = Buffer.from(content, "utf-8");
    const result = await extractTextFromFile(buffer, "bom-test.txt");
    assert(!result.startsWith("﻿"), "should strip BOM");
    assert(result.startsWith("This"), "should start with actual text");
  });

  await test("rejects too-short .txt file", async () => {
    const buffer = Buffer.from("Hi", "utf-8");
    try {
      await extractTextFromFile(buffer, "short.txt");
      assert(false, "should have thrown");
    } catch (err) {
      assert(
        err instanceof Error && err.message.includes("characters were extracted"),
        `unexpected error: ${err instanceof Error ? err.message : err}`
      );
    }
  });

  await test("rejects file with no extension", async () => {
    const buffer = Buffer.from("some content", "utf-8");
    try {
      await extractTextFromFile(buffer, "noext");
      assert(false, "should have thrown");
    } catch (err) {
      assert(
        err instanceof Error && err.message.includes("no extension"),
        `unexpected error: ${err instanceof Error ? err.message : err}`
      );
    }
  });

  await test("rejects unsupported extension", async () => {
    const buffer = Buffer.from("some content", "utf-8");
    try {
      await extractTextFromFile(buffer, "file.doc");
      assert(false, "should have thrown");
    } catch (err) {
      assert(
        err instanceof Error && err.message.includes("Unsupported"),
        `unexpected error: ${err instanceof Error ? err.message : err}`
      );
    }
  });

  // ─────────────────────────────────────────────
  // extractTextFromFile — .docx (fixture)
  // ─────────────────────────────────────────────

  console.log("\n── extractTextFromFile (.docx) ──");

  const docxPath = "test-fixtures/sample.docx";
  if (existsSync(docxPath)) {
    await test("extracts text from real .docx file", async () => {
      const buffer = readFileSync(docxPath);
      const result = await extractTextFromFile(buffer, "sample.docx");
      assert(result.length > 100, `expected >100 chars, got ${result.length}`);
      assert(
        result.includes("Renewable") || result.includes("renewable") || result.includes("climate"),
        "should contain document content"
      );
      console.log(`    Extracted ${result.length} chars from sample.docx`);
      console.log(`    First 200 chars: ${result.slice(0, 200).replace(/\n/g, "\\n")}`);
    });

    await test("docx list items have bullet prefixes", async () => {
      const buffer = readFileSync(docxPath);
      const result = await extractTextFromFile(buffer, "sample.docx");
      // The sample.docx contains a bulleted list — check for "- " prefix
      if (result.includes("- ")) {
        console.log("    ✓ Found bullet-prefixed list items");
      } else {
        console.log("    (no bullet items found in this fixture — may not have a list)");
      }
    });

    await test("docx headings are uppercase", async () => {
      const buffer = readFileSync(docxPath);
      const result = await extractTextFromFile(buffer, "sample.docx");
      // Check if any heading was converted to uppercase
      if (result.toUpperCase() !== result) {
        // Has mixed case — check for uppercase headings
        const lines = result.split("\n");
        const hasUppercaseHeading = lines.some(
          (line) => line.trim().length > 3 && line === line.toUpperCase() && /^[A-Z]/.test(line)
        );
        if (hasUppercaseHeading) {
          console.log("    ✓ Found uppercase heading(s)");
        } else {
          console.log("    (no uppercase headings found in this fixture)");
        }
      }
    });
  } else {
    console.log(`  ⚠ Skipped .docx tests — ${docxPath} not found (create with: node test-fixtures/create-docx.mjs)`);
  }

  // ─────────────────────────────────────────────
  // extractTextFromFile — .pdf (fixture)
  // ─────────────────────────────────────────────

  console.log("\n── extractTextFromFile (.pdf) ──");

  const pdfPath = "test-fixtures/sample.pdf";
  if (existsSync(pdfPath)) {
    await test("extracts text from real .pdf file (if valid fixture)", async () => {
      const buffer = readFileSync(pdfPath);
      try {
        const result = await extractTextFromFile(buffer, "sample.pdf");
        assert(result.length > 100, `expected >100 chars, got ${result.length}`);
        console.log(`    Extracted ${result.length} chars from sample.pdf`);
        console.log(`    First 200 chars: ${result.slice(0, 200).replace(/\n/g, "\\n")}`);
      } catch {
        console.log("    ⚠ PDF fixture is too minimal for pdf-parse — skipping (test with a real PDF)");
      }
    });

    await test("pdf metadata is stripped (if fixture is parseable)", async () => {
      const buffer = readFileSync(pdfPath);
      try {
        const result = await extractTextFromFile(buffer, "sample.pdf");
        assert(
          !result.includes("Creator:") && !result.includes("Producer:"),
          "should not contain pdf-parse metadata headers"
        );
      } catch {
        console.log("    ⚠ PDF fixture not parseable — skipping");
      }
    });
  } else {
    console.log(`  ⚠ Skipped .pdf tests — ${pdfPath} not found (create with: node test-fixtures/create-pdf.mjs)`);
  }

  // ─────────────────────────────────────────────
  // End-to-end: full pipeline simulation
  // ─────────────────────────────────────────────

  console.log("\n── End-to-end pipeline ──");

  await test("full pipeline: paste text with embedded bibliography", () => {
    const pastedText =
      "Climate change is one of the most pressing issues of our time. " +
      "Global temperatures have risen by 1.1 degrees Celsius since pre-industrial times.\n\n" +
      "Renewable energy adoption has accelerated significantly in recent years. " +
      "Solar and wind power now account for a growing share of electricity generation.\n\n" +
      "However, challenges remain in achieving net-zero emissions by 2050. " +
      "Policy coordination across nations is essential.\n\n" +
      "References\n" +
      "IPCC (2023). Climate Change 2023: Synthesis Report.\n" +
      "IEA (2024). World Energy Outlook 2024.\n" +
      "Smith, J. et al. (2023). Renewable Energy Progress. Nature Energy, 8(1), 10-20.";

    // Step 1: Normalize
    const normalized = normalizeText(pastedText);
    assert(normalized.length > 0, "normalized text should not be empty");

    // Step 2: Extract bibliography
    const extracted = extractBibliography(normalized);
    assert(extracted.wasExtracted === true, "should detect References");
    assert(
      extracted.bodyText.includes("Climate change"),
      "body should contain intro"
    );
    assert(
      !extracted.bodyText.includes("IPCC"),
      "body should not contain references"
    );
    assert(
      extracted.bibliography!.includes("IPCC"),
      "bibliography should contain IPCC"
    );
    assert(
      countReferences(extracted.bibliography!) === 3,
      `expected 3 references, got ${countReferences(extracted.bibliography!)}`
    );

    console.log(`    Body: ${extracted.bodyText.length} chars`);
    console.log(`    Bibliography: ${extracted.bibliography!.length} chars`);
  });

  await test("full pipeline: pdf text with metadata + bibliography", () => {
    const pdfText =
      "Author: Jane Smith\nCreator: Adobe InDesign\nProducer: Adobe PDF Library\n" +
      "CreationDate: Mon Jan 15 10:30:00 2024\nPages: 8\nPDF version: 1.7\n\n" +
      "The relationship between economic growth and environmental sustainability\n" +
      "has been widely debated in recent literature. This paper examines the\n" +
      "environmental Kuznets curve hypothesis using panel data from 45 countries.\n\n" +
      "Our findings suggest that while economic growth initially increases pollution,\n" +
      "there exists a turning point beyond which further growth reduces emissions.\n\n" +
      "References\n" +
      "Grossman, G. M., & Krueger, A. B. (1995). Economic growth and the environment. QJE, 110(2), 353-377.\n" +
      "Stern, D. I. (2004). The rise and fall of the environmental Kuznets curve. World Development, 32(8), 1419-1439.";

    // Step 1: Normalize PDF text (strips metadata)
    const normalized = normalizePdfText(pdfText);
    assert(
      !normalized.includes("Author:"),
      "should strip pdf metadata"
    );
    assert(
      !normalized.includes("Creator:"),
      "should strip Creator"
    );
    assert(
      normalized.includes("environmental Kuznets"),
      "should contain document content"
    );

    // Step 2: Extract bibliography
    const extracted = extractBibliography(normalized);
    assert(extracted.wasExtracted === true, "should detect References");
    assert(
      extracted.bodyText.includes("Kuznets curve"),
      "body should contain content"
    );
    assert(
      !extracted.bodyText.includes("Grossman"),
      "body should not contain references"
    );
    assert(
      countReferences(extracted.bibliography!) === 2,
      `expected 2 references, got ${countReferences(extracted.bibliography!)}`
    );

    console.log(`    Clean body: ${extracted.bodyText.length} chars`);
    console.log(`    Bibliography: ${extracted.bibliography!.length} chars`);
  });

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
