// ============================================================
// Search provider factory
//
// Central entry point for getting a search provider instance.
// Returns null if search is not configured (graceful degradation).
// ============================================================

import type { SearchProvider, SearchConfig } from "./types";
import { GoogleCustomSearchProvider } from "./providers/google-custom-search";

function getSearchConfig(): SearchConfig | null {
  const apiUrl = process.env.SEARCH_API_URL;
  const apiKey = process.env.SEARCH_API_KEY;
  const engineId = process.env.SEARCH_ENGINE_ID;

  // Search is optional — return null if not configured
  if (!apiUrl || !apiKey || !engineId) {
    return null;
  }

  return { apiUrl, apiKey, engineId };
}

/**
 * Get the configured search provider.
 * Returns null if search is not configured (graceful degradation).
 * Add conditional logic here when supporting multiple providers.
 */
export function getSearchProvider(): SearchProvider | null {
  const config = getSearchConfig();
  if (!config) return null;
  return new GoogleCustomSearchProvider(config);
}

/**
 * Check if search is configured (for UI to show/hide the button).
 */
export function isSearchConfigured(): boolean {
  return getSearchConfig() !== null;
}
