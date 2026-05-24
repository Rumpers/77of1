// Text generation dispatch — OF-62
// Pipeline: load persona + config → build system prompt → retrieve RAG →
// call ITextProvider.generate() → post-generation hard-stop filter → write result.
//
// Called by the worker after consent is verified (ADR-011).
// NEVER call this without a live-checked consent grant.

import { createClient } from "@7of1/db";
import {
  buildSystemPrompt,
  createEmbeddingProvider,
  createGmiTextProvider,
  containsHardStop,
  buildGracefulDecline,
} from "@7of1/ai-providers";
import type { TextContext, DbCreatorPersona, DbCreatorConfig } from "@7of1/types";

type SupabaseClient = ReturnType<typeof createClient>;

const RAG_TOP_K = 5;
const MAX_HARD_STOP_RETRIES = 2;

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function resolveLanguage(
  languages: string[]
): "en" | "ja" | "zh-TW" {
  const supported = new Set(["en", "ja", "zh-TW"]);
  for (const lang of languages) {
    if (supported.has(lang)) return lang as "en" | "ja" | "zh-TW";
  }
  return "en";
}

export interface TextDispatchInput {
  jobId: string;
  creatorId: string;
  fanId: string;
  prompt: string;
}

export interface TextDispatchResult {
  text: string;
  tokensUsed: number;
  modelId: string;
  latencyMs: number;
}

export async function dispatchTextGeneration(
  input: TextDispatchInput,
  supabase: SupabaseClient
): Promise<TextDispatchResult> {
  const { creatorId, prompt } = input;
  const dispatchStart = Date.now();

  // ── 1. Load creator persona (7 fields from creator_personas) ─────────────
  const { data: personaData, error: personaErr } = await supabase
    .from("creator_personas")
    .select(
      "id, creator_id, greeting_style, fan_endearment, emoji_usage, " +
        "bounds, treatment_style, personality_traits, message_style, intensity_dial, updated_at"
    )
    .eq("creator_id", creatorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (personaErr) {
    throw new Error(`[text-dispatch] persona load failed: ${personaErr.message}`);
  }
  if (!personaData) {
    throw new Error(
      `[text-dispatch] no persona for creator=${creatorId} — onboarding incomplete`
    );
  }
  const persona = personaData as unknown as DbCreatorPersona;

  // ── 2. Load creator config (intensity_dial, forbidden_topics, handle) ─────
  const { data: configData, error: configErr } = await supabase
    .from("creator_config")
    .select(
      "creator_id, handle, intensity_dial, forbidden_topics, languages_served, paused"
    )
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (configErr) {
    throw new Error(`[text-dispatch] config load failed: ${configErr.message}`);
  }
  if (!configData) {
    throw new Error(`[text-dispatch] no config for creator=${creatorId}`);
  }
  const config = configData as unknown as Pick<
    DbCreatorConfig,
    "creator_id" | "handle" | "intensity_dial" | "forbidden_topics" | "languages_served" | "paused"
  >;

  if (config.paused) {
    throw new Error(`[text-dispatch] creator=${creatorId} twin is paused`);
  }

  const language = resolveLanguage(config.languages_served);
  const forbiddenTopics = config.forbidden_topics;

  // ── 3. Build system prompt (OF-62 persona builder) ────────────────────────
  // Persona builder: 7 fields + intensity + forbidden_topics + language → systemPrompt
  const systemPrompt = buildSystemPrompt({
    creatorHandle: config.handle,
    persona,
    intensityDial: config.intensity_dial,
    forbiddenTopics,
    language,
  });

  // ── 4. Retrieve RAG chunks (embedding → pgvector cosine search) ───────────
  let ragChunks: string[] = [];
  try {
    const embeddingProvider = createEmbeddingProvider();
    const { embedding } = await embeddingProvider.embed(prompt);
    const { data: ragData } = await supabase.rpc("match_creator_content", {
      query_embedding: vectorLiteral(embedding),
      p_creator_id: creatorId,
      match_count: RAG_TOP_K,
    });
    ragChunks = ((ragData ?? []) as { chunk_text: string }[]).map(
      (row) => row.chunk_text
    );
    console.log(
      `[text-dispatch] RAG creator=${creatorId} chunks=${ragChunks.length}`
    );
  } catch (ragErr) {
    // RAG is non-fatal — degrade gracefully to prompt-only generation
    console.warn(
      `[text-dispatch] RAG failed for creator=${creatorId}: ${String(ragErr)}`
    );
  }

  // ── 5. Assemble TextContext and call ITextProvider.generate() ─────────────
  // TextContext.systemPrompt carries the full persona instruction (from buildSystemPrompt).
  // RAG chunks are injected by the provider before the API call.
  const context: TextContext = {
    creatorId,
    systemPrompt,
    ragChunks,
    intensityDial: config.intensity_dial,
    language,
  };

  const provider = createGmiTextProvider();

  // ── 6. Hard-stop enforcement (post-generation filter) ─────────────────────
  // Belt-and-suspenders: forbidden topics are in systemPrompt via persona builder.
  // Post-generation filter catches any LLM leakage (max MAX_HARD_STOP_RETRIES).
  let response = await provider.generate(prompt, context);

  for (let attempt = 0; attempt < MAX_HARD_STOP_RETRIES; attempt++) {
    if (!containsHardStop(response.text, forbiddenTopics)) break;
    console.warn(
      `[text-dispatch] hard-stop triggered attempt=${attempt + 1}` +
        ` job=${input.jobId} creator=${creatorId}`
    );
    response = await provider.generate(prompt, context);
  }

  if (containsHardStop(response.text, forbiddenTopics)) {
    // All retries exhausted — return graceful decline in creator's voice
    response = {
      ...response,
      text: buildGracefulDecline(persona.fan_endearment),
    };
    console.warn(
      `[text-dispatch] hard-stop: graceful decline job=${input.jobId}` +
        ` creator=${creatorId}`
    );
  }

  const totalMs = Date.now() - dispatchStart;
  console.log(
    `[text-dispatch] done job=${input.jobId} creator=${creatorId}` +
      ` model=${response.modelId} tokens=${response.tokensUsed} total_ms=${totalMs}`
  );

  return {
    text: response.text,
    tokensUsed: response.tokensUsed,
    modelId: response.modelId,
    latencyMs: totalMs,
  };
}
