import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import { AIConfigStore } from "./AIConfigStore";
import type { AIProvidersConfig } from "./types";

/**
 * Convenience: load AI provider config in a single call.
 * Eliminates the repeated DB → KVStore → AIConfigStore → getProviders() boilerplate.
 */
export async function getAIProviders(): Promise<AIProvidersConfig> {
  const db = await openAlexQuantDB();
  const kv = new KVStore(db);
  const configStore = new AIConfigStore(kv);
  return configStore.getProviders();
}
