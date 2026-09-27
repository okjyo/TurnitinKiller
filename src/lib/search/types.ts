// ============================================================
// Search provider types
//
// Abstract interface for web search backends.
// Implement this to add new search providers (Bing, SerpAPI, etc.)
// ============================================================

/**
 * A single search result from a web search provider.
 */
export interface SearchResult {
  /** Page title */
  title: string;
  /** Full URL of the result */
  url: string;
  /** Snippet/excerpt from the page (may be truncated) */
  snippet: string;
}

/**
 * Provider interface — implement this to swap search backends.
 * Currently only GoogleCustomSearchProvider exists.
 */
export interface SearchProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Run a web search query.
   * Returns an array of results (may be empty if nothing matches).
   * Throws on API errors, rate limits, or network failures.
   */
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

/**
 * Configuration for connecting to a search API.
 */
export interface SearchConfig {
  apiUrl: string;
  apiKey: string;
  /** Search engine ID (e.g., Google Custom Search CX) */
  engineId: string;
}
