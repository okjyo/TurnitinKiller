// ============================================================
// LLM provider types
// ============================================================

/**
 * Provider interface — implement this to swap LLM backends.
 * Currently only OpenAICompatibleProvider exists.
 */
export interface LLMProvider {
  /** Provider name for logging */
  readonly name: string;

  /** Send a chat completion request, return the assistant's text */
  complete(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" };
  }): Promise<string>;
}

/** Configuration for connecting to an LLM API */
export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

/** Input to the analysis pipeline */
export interface AnalysisInput {
  text: string;
  bibliography?: string;
}