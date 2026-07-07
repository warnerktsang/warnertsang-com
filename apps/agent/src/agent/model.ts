import "server-only";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";

/**
 * Model provider abstraction. Business logic depends on this, not on a specific
 * provider SDK, so swapping providers is a config/one-function change.
 */
export function getAgentModel(): LanguageModel {
  switch (env.AGENT_MODEL_PROVIDER) {
    case "openai":
      return openai(env.AGENT_MODEL);
    // Future: case "anthropic": return anthropic(env.AGENT_MODEL);
    default:
      throw new Error(
        `Unsupported AGENT_MODEL_PROVIDER: ${env.AGENT_MODEL_PROVIDER}`,
      );
  }
}
