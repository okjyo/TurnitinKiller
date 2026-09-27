// ============================================================
// Google Custom Search JSON API provider
//
// Uses the Programmable Search Engine API.
// Free tier: 100 queries/day, $5 per 1,000 after.
//
// Docs: https://developers.google.com/custom-search/v1/overview
// ============================================================

import type { SearchProvider, SearchConfig, SearchResult } from "../types";

// ─────────────────────────────────────────────
// Retry + timeout configuration
// ─────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Error sanitization
// ─────────────────────────────────────────────

function sanitizeError(err: unknown): Error {
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return new Error(
        "Search request timed out. Please try again."
      );
    }
    if (err.message.startsWith("Search API error")) {
      const statusMatch = err.message.match(/\((\d+)\)/);
      const status = statusMatch ? statusMatch[1] : "unknown";
      if (status === "429") {
        return new Error(
          "Search rate limit reached. Please try again in a few minutes."
        );
      }
      return new Error(
        `Search service returned an error (status ${status}). Please try again.`
      );
    }
  }
  return new Error("Something went wrong during web search. Please try again.");
}

// ─────────────────────────────────────────────
// Provider implementation
// ─────────────────────────────────────────────

export class GoogleCustomSearchProvider implements SearchProvider {
  readonly name = "google-custom-search";
  private readonly config: SearchConfig;

  constructor(config: SearchConfig) {
    this.config = config;
  }

  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    const { apiUrl, apiKey, engineId } = this.config;

    // Build the URL with query params
    const params = new URLSearchParams({
      key: apiKey,
      cx: engineId,
      q: query,
      num: String(Math.min(maxResults, 10)), // Google max is 10 per request
    });

    const url = `${apiUrl}?${params.toString()}`;

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text();
          const err = new Error(`Search API error (${response.status}): ${errorBody}`);

          if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
            lastError = err;
            continue;
          }

          throw sanitizeError(err);
        }

        const data = await response.json();

        // Google returns { items: [...] } or nothing if no results
        if (!data.items || !Array.isArray(data.items)) {
          return [];
        }

        return data.items.map((item: { title?: string; link?: string; snippet?: string }) => ({
          title: item.title || "",
          url: item.link || "",
          snippet: item.snippet || "",
        }));
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof Error && err.name === "AbortError") {
          lastError = err;
          if (attempt < MAX_RETRIES) continue;
        }

        throw sanitizeError(err);
      }
    }

    throw sanitizeError(lastError);
  }
}
