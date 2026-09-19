// ============================================================
// Analyze page — paste/upload text + bibliography, submit
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload or paste your assignment below. We&apos;ll review it and provide
          coaching feedback to help you strengthen it before submission.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Paper Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Climate Change Policy Analysis — Draft 2"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Upload File (optional — or paste text below)
          </label>
          <div className="mt-1">
            {fileName ? (
              <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                <svg
                  className="h-5 w-5 text-gray-400"
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
                <span className="flex-1 text-sm text-gray-700">{fileName}</span>
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
                className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 px-6 py-8 transition hover:border-brand-400 hover:bg-brand-50"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-gray-400"
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
                  <p className="mt-2 text-sm text-gray-600">
                    Click to upload <span className="font-medium">.docx</span>,{" "}
                    <span className="font-medium">.pdf</span>, or{" "}
                    <span className="font-medium">.txt</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">Max 10 MB</p>
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
          <label htmlFor="rawText" className="block text-sm font-medium text-gray-700">
            Or Paste Your Text
          </label>
          <textarea
            id="rawText"
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={12}
            placeholder="Paste your assignment text here..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 font-mono text-sm"
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
            className="block text-sm font-medium text-gray-700"
          >
            Bibliography / References{" "}
            <span className="font-normal text-gray-400">(optional)</span>
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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 font-mono text-sm"
          />
        </div>

        {/* Submit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
            className="order-1 rounded-md bg-brand-800 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:opacity-50 transition sm:order-2"
          >
            {loading ? "Analyzing..." : "Analyze My Paper"}
          </button>
        </div>
      </form>
    </div>
  );
}
