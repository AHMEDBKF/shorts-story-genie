import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mockImage, mockMusic, mockText, mockVoice } from "./mock.server";
import type {
  Capability,
  ImageProvider,
  MusicProvider,
  TextProvider,
  VoiceProvider,
} from "./types";

type AnyProvider = TextProvider | ImageProvider | VoiceProvider | MusicProvider;

/**
 * Registry of available implementations. Adding a real provider later means
 * registering it here and inserting a row in `ai_providers` — nothing else
 * in the pipeline changes.
 */
export const REGISTRY: Record<Capability, Record<string, AnyProvider>> = {
  text: { "mock-text": mockText },
  image: { "mock-image": mockImage },
  voice: { "mock-voice": mockVoice },
  music: { "mock-music": mockMusic },
};

export class NoProviderError extends Error {
  constructor(capability: Capability) {
    super(`لا يوجد مزوّد مفعّل لخدمة: ${capability}`);
  }
}

/**
 * Returns the ordered list of usable providers for a capability.
 * In Low Cost Mode only free-tier providers are considered, and a provider
 * that requires payment is never used unless it was explicitly approved.
 */
export async function resolveProviders<T extends AnyProvider>(
  userId: string,
  capability: Capability,
  lowCostMode: boolean,
): Promise<{ row: { id: string; key: string; label: string }; impl: T }[]> {
  const { data, error } = await supabaseAdmin
    .from("ai_providers")
    .select("id, key, label, cost_tier, enabled, requires_approval, approved, priority")
    .eq("user_id", userId)
    .eq("capability", capability)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);

  const usable = (data ?? []).filter((row) => {
    if (lowCostMode && row.cost_tier !== "free") return false;
    if (row.cost_tier === "paid" && !row.approved) return false;
    if (row.requires_approval && !row.approved) return false;
    return Boolean(REGISTRY[capability][row.key]);
  });

  return usable.map((row) => ({
    row: { id: row.id, key: row.key, label: row.label },
    impl: REGISTRY[capability][row.key] as T,
  }));
}

/** Runs `fn` against each usable provider in order, falling back on failure. */
export async function withProvider<T extends AnyProvider, R>(
  userId: string,
  capability: Capability,
  lowCostMode: boolean,
  fn: (impl: T) => Promise<R>,
): Promise<{ result: R; providerKey: string }> {
  const candidates = await resolveProviders<T>(userId, capability, lowCostMode);
  if (candidates.length === 0) throw new NoProviderError(capability);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await fn(candidate.impl);
      await supabaseAdmin
        .from("ai_providers")
        .update({ status: "ready", last_error: null, last_used_at: new Date().toISOString() })
        .eq("id", candidate.row.id);
      return { result, providerKey: candidate.row.key };
    } catch (error) {
      lastError = error;
      await supabaseAdmin
        .from("ai_providers")
        .update({
          status: "error",
          last_error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", candidate.row.id);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
