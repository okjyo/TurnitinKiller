// ============================================================
// Analyze page — paste/upload text + bibliography, submit
//
// Two-column on desktop: form (left) + preview example (right).
// 3-step progress indicator at top. Serif section labels.
// ============================================================

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export default function AnalyzePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [bibliographyText, setBibliographyText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Track which input source the user chose last, to surface
  // a clear warning when they have both
  const [inputConflict, setInputConflict] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "docx", "pdf"].includes(ext)) {
      setError("Please upload a .txt, .docx, or .pdf file.");
      return;
    }

    // Client-side file size check (avoid a round-trip for obvious failures)
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File is too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`
      );
      return;
    }

    setFile(selected);
    setFileName(selected.name);
    setError(null);

    if (rawText.trim()) {
      setInputConflict(true);
    } else {
      setInputConflict(false);
    }
  }

  function handleRemoveFile() {
    setFile(null);
    setFileName(null);
    setInputConflict(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleTextChange(value: string) {
    setRawText(value);
    if (value.trim() && file) {
      setInputConflict(true);
    } else {
      setInputConflict(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please give your paper a title.");
      return;
    }

    if (!rawText.trim() && !file) {
      setError("Please paste your text or upload a file.");
      return;
    }

    if (rawText.trim() && file) {
      setError(
        "You have both pasted text and an uploaded file. Please use only one — remove the file to use pasted text, or clear the text box to use the file."
      );
      return;
    }

    setLoading(true);
    setProgress("Uploading and analyzing your paper...");

    try {
      const formData = new FormData();
      formData.append("title", title);
      if (rawText) formData.append("rawText", rawText);
      if (bibliographyText) formData.append("bibliographyText", bibliographyText);
      if (file) formData.append("file", file);

      setProgress("Analyzing your paper — this may take a minute...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      // Parse response body — handle both JSON success and non-JSON errors
      let data: { reportId?: string; error?: string };
      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? "Received an unexpected response from the server."
            : `Server error (${response.status}). Please try again.`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed. Please try again.");
      }

      setProgress("Done! Redirecting to your report...");
      router.push(`/report/${data.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div>
      {/* ── Page header ────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
          Analysis
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-brand-900 sm:text-3xl">
          New Analysis
        </h1>
      </div>

      {/* ── 3-step progress indicator ─────────────────────── */}
      <div className="mt-6 flex items-center gap-3 text-sm text-gray-500">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 font-serif text-xs font-bold text-brand-700">1</span>
          <span className="hidden sm:inline">Add your text</span>
          <span className="sm:hidden">Add text</span>
        </span>
        <svg className="h-4 w-4 text-brand-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 font-serif text-xs font-bold text-brand-700">2</span>
          We analyze
        </span>
        <svg className="h-4 w-4 text-brand-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 font-serif text-xs font-bold text-brand-700">3</span>
          Get coaching
        </span>
      </div>

      {/* ── Two-column layout: form + preview ─────────────── */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-12">

        {/* Left column: form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {progress && (
            <div className="rounded-md bg-brand-50 p-4 text-sm text-brand-700 flex items-center gap-3">
              <svg
                className="h-5 w-5 animate-spin text-brand-700"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {progress}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block font-serif text-sm font-semibold text-gray-800">
              Paper Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Climate Change Policy Analysis — Draft 2"
              className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block font-serif text-sm font-semibold text-gray-800">
              Upload File
            </label>
            <p className="mt-0.5 text-xs text-gray-500">Or paste your text below instead.</p>
            <div className="mt-2">
              {fileName ? (
                <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
                  <svg
                    className="h-5 w-5 text-brand-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  <span className="flex-1 text-sm font-medium text-brand-800">{fileName}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 transition ${
                    dragOver
                      ? "border-brand-500 bg-brand-100 ring-2 ring-brand-200"
                      : "border-brand-200 bg-brand-50/70 hover:border-brand-400 hover:bg-brand-50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) {
                      const ext = dropped.name.split(".").pop()?.toLowerCase();
                      if (!ext || !["txt", "docx", "pdf"].includes(ext)) {
                        setError("Please upload a .txt, .docx, or .pdf file.");
                        return;
                      }
                      if (dropped.size > MAX_FILE_SIZE_BYTES) {
                        setError(
                          `File is too large (${(dropped.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`
                        );
                        return;
                      }
                      setFile(dropped);
                      setFileName(dropped.name);
                      setError(null);
                      if (rawText.trim()) {
                        setInputConflict(true);
                      } else {
                        setInputConflict(false);
                      }
                    }
                  }}
                >
                  <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
                      <svg
                        className={`h-7 w-7 transition ${
                          dragOver ? "text-brand-700" : "text-brand-500"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-medium text-brand-800">
                      {dragOver ? "Drop your file here" : (
                        <>
                          Click to upload <span className="font-semibold">.docx</span>,{" "}
                          <span className="font-semibold">.pdf</span>, or{" "}
                          <span className="font-semibold">.txt</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-brand-500">Max 10 MB</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Paste text */}
          <div>
            <label htmlFor="rawText" className="block font-serif text-sm font-semibold text-gray-800">
              Or Paste Your Text
            </label>
            <textarea
              id="rawText"
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={10}
              placeholder="Paste your assignment text here..."
              className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 font-mono text-sm"
            />
          </div>

          {/* Conflict warning */}
          {inputConflict && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <span className="font-medium">Both sources detected.</span>{" "}
              You have pasted text and an uploaded file. Please use only one —{" "}
              <button
                type="button"
                onClick={handleRemoveFile}
                className="underline font-medium hover:text-amber-900"
              >
                remove the file
              </button>{" "}
              to use your pasted text, or{" "}
              <button
                type="button"
                onClick={() => {
                  setRawText("");
                  setInputConflict(false);
                }}
                className="underline font-medium hover:text-amber-900"
              >
                clear the text box
              </button>{" "}
              to use the file.
            </div>
          )}

          {/* Bibliography */}
          <div>
            <label
              htmlFor="bibliography"
              className="block font-serif text-sm font-semibold text-gray-800"
            >
              Bibliography / References{" "}
              <span className="font-sans font-normal text-gray-400">(optional)</span>
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              If you paste your reference list separately, we can cross-check your
              in-text citations against it.
            </p>
            <textarea
              id="bibliography"
              value={bibliographyText}
              onChange={(e) => setBibliographyText(e.target.value)}
              rows={6}
              placeholder="Smith, J. (2024). Title of the article. Journal Name, 12(3), 45-67."
              className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 font-mono text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="order-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || inputConflict}
              className="order-1 rounded-md bg-brand-800 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:opacity-50 transition sm:order-2"
            >
              {loading ? "Analyzing..." : "Analyze My Paper"}
            </button>
          </div>
        </form>

        {/* Right column: preview example (desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <p className="font-serif text-sm font-semibold text-gray-800">What you&apos;ll get</p>
            <p className="mt-1 text-xs text-gray-500">
              A coaching report like this — with specific findings, explanations, and suggested fixes.
            </p>

            {/* Mini finding card preview */}
            <div className="mt-5 space-y-4">
              <PreviewFindingCard
                category="Citation Needed"
                categoryColor="amber"
                quote="&ldquo;Renewable energy adoption has increased by 40% globally since 2015.&rdquo;"
                issue="This is a specific statistic that would benefit from a supporting citation."
                suggestion="Add a citation after the claim, e.g. (IRENA, 2023)."
              />
              <PreviewFindingCard
                category="Vague Phrasing"
                categoryColor="sky"
                quote="&ldquo;Studies show that remote work improves productivity.&rdquo;"
                issue="&ldquo;Studies show&rdquo; implies evidence — which studies?"
                suggestion="Name the specific sources so your reader can verify the claim."
              />
              <PreviewFindingCard
                category="Structural Issue"
                categoryColor="gray"
                quote="(Reference list detected automatically)"
                issue="We found a reference list with 12 entries, cross-checked against your citations."
                suggestion="Verify the reference list was correctly identified."
                faded
              />
            </div>

            {/* Reassurance line */}
            <p className="mt-6 text-xs text-gray-400 italic">
              Not a score. Not a percentage. Just clear guidance on what to fix and how.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Preview finding card — miniature version of
// the real FindingCard used on the report page
// ─────────────────────────────────────────────

function PreviewFindingCard({
  category,
  categoryColor,
  quote,
  issue,
  suggestion,
  faded = false,
}: {
  category: string;
  categoryColor: "amber" | "sky" | "gray";
  quote: string;
  issue: string;
  suggestion: string;
  faded?: boolean;
}) {
  const colorMap = {
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", dot: "bg-amber-400" },
    sky: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800", dot: "bg-sky-400" },
    gray: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", dot: "bg-gray-400" },
  };
  const c = colorMap[categoryColor];

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${faded ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>
          {category}
        </span>
      </div>
      <blockquote className="border-l-2 border-brand-200 pl-3 text-xs italic text-gray-600">
        {quote}
      </blockquote>
      <p className="mt-2 text-xs text-gray-700 leading-relaxed">
        {issue}
      </p>
      <div className={`mt-2.5 rounded-md ${c.bg} ${c.border} border px-3 py-2`}>
        <p className={`text-xs ${c.text}`}>
          <span className="font-medium">Suggestion:</span> {suggestion}
        </p>
      </div>
    </div>
  );
}