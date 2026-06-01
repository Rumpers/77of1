/**
 * Central config for the LoRA likeness spike. Edit here — the scripts read from this.
 * THROWAWAY: this is a test harness, not production code.
 */

export const config = {
  // ── Subject / dataset ──────────────────────────────────────────────
  /** Folder of source photos (gitignored). Relative to the spike root. */
  photosDir: "data/photos/claire",

  /** Unique, non-dictionary trigger token. Case-insensitive on FLUX. */
  triggerWord: "CLAIRE_V1",

  /**
   * Destination model name on Replicate. Combined with REPLICATE_OWNER from .env,
   * the trained LoRA is pushed to `<owner>/<destModelName>`.
   */
  destModelName: "claire-lora-spike",

  // ── Training (Replicate: ostris/flux-dev-lora-trainer) ─────────────
  training: {
    trainerModel: "ostris/flux-dev-lora-trainer",
    steps: 1000, // ~$1.5/run at default; bump to 1500 if underfit, drop if overfit
    loraRank: 16, // 16 = smaller/faster, usually enough for one person; 32 = higher fidelity
    learningRate: 0.0004,
    autocaption: true, // service auto-captions the zip; fine for a first test
    resolution: "512,768,1024",
  },

  // ── Eval gallery generation ────────────────────────────────────────
  generation: {
    /** LoRA-strength sweep (EVAL-01). Encoded into output filenames. */
    loraScales: [0.6, 0.75, 0.85, 1.0],
    /** Fixed seeds so the grid is reproducible across strengths. */
    seeds: [1111, 2222],
    aspectRatio: "3:4",
    numInferenceSteps: 28,
    guidanceScale: 3.0,
    outputFormat: "jpg" as const,
  },

  // ── Prompts (SFW ONLY — GATE-04 guardrail) ─────────────────────────
  // All prompts must keep {trigger} as the subject. Keep everything safe-for-work.
  prompts: [
    { id: "studio_portrait", text: "a professional studio headshot photo of {trigger}, soft lighting, neutral background, sharp focus" },
    { id: "candid_outdoor", text: "a candid outdoor photo of {trigger} walking in a city street, natural daylight, casual outfit" },
    { id: "halfbody_cafe", text: "a half-body photo of {trigger} sitting in a cafe, warm ambient light, smiling" },
    { id: "fullbody_formal", text: "a full-body photo of {trigger} wearing an elegant formal dress, studio lighting" },
  ],

  // ── Bleed / overfit check (EVAL-02) ────────────────────────────────
  // Same model, LoRA active, NO trigger word. If output still looks like the subject,
  // the LoRA has bled into the base model (overfit warning sign).
  bleedCheck: {
    enabled: true,
    prompt: "a professional studio headshot photo of a person, soft lighting, neutral background",
    loraScale: 1.0,
    seed: 1111,
  },
} as const;

export type SpikeConfig = typeof config;
