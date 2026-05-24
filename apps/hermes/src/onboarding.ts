// Onboarding Step 2 — persona exercise completed → RAG ingest
// Triggered when a creator finishes the persona exercise flow.
// Embeds persona fields and stores them in creator_content_embeddings.

import { createClient, getSupabaseUrl, getSupabaseServiceKey } from "@7of1/db";
import { createEmbeddingProvider } from "@7of1/ai-providers";
import { ingestPersonaExercise } from "@7of1/rag";

const getDb = () => createClient(getSupabaseUrl(), getSupabaseServiceKey());

export interface OnboardingIngestResult {
  creatorId: string;
  totalChunks: number;
  provider: string;
}

// Called after persona exercise is completed (Step 2 of onboarding).
// Loads persona from DB and ingests all fields into the RAG index.
export async function triggerPersonaRagIngest(
  creatorId: string
): Promise<OnboardingIngestResult> {
  const db = getDb();

  const { data: persona, error } = await db
    .from("creator_personas")
    .select(
      "greeting_style, fan_endearment, treatment_style, personality_traits, message_style, bounds"
    )
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) throw new Error(`Persona load failed: ${error.message}`);
  if (!persona) throw new Error(`No persona found for creator ${creatorId}`);

  const personaFields: Record<string, string> = {
    greeting_style: persona.greeting_style ?? "",
    fan_endearment: persona.fan_endearment ?? "",
    treatment_style: persona.treatment_style ?? "",
    personality_traits: Array.isArray(persona.personality_traits)
      ? persona.personality_traits.join(". ")
      : "",
    message_style: persona.message_style ?? "",
    bounds: Array.isArray(persona.bounds) ? persona.bounds.join(". ") : "",
  };

  const embeddingProvider = createEmbeddingProvider();
  const results = await ingestPersonaExercise(
    creatorId,
    personaFields,
    embeddingProvider
  );

  const totalChunks = results.reduce((sum, r) => sum + r.chunksIngested, 0);
  const provider = results[0]?.provider ?? embeddingProvider.provider;

  console.log(
    `[onboarding] persona RAG ingest complete creator=${creatorId} chunks=${totalChunks} provider=${provider}`
  );

  return { creatorId, totalChunks, provider };
}
