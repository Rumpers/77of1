export type CreatorId = string;
export type FanSessionId = string;
export type ConsentGrantId = string;

export type ConsentModality = "text" | "voice" | "video" | "image";

export type ConsentGrant = {
  id: ConsentGrantId;
  creatorId: CreatorId;
  modality: ConsentModality;
  version: number;
  grantedAt: Date;
  revokedAt?: Date;
};

export type CreatorPersona = {
  id: CreatorId;
  greetingStyle: string;
  fanEndearment: string;
  emojiUsage: "none" | "minimal" | "moderate" | "heavy";
  bounds: string[];
  treatmentStyle: string;
  personalityTraits: string[];
  messageStyle: string;
  intensityDial: "warm" | "intimate" | "explicit";
};

export type GenerationJobStatus =
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export type GenerationJob = {
  id: string;
  creatorId: CreatorId;
  fanSessionId: FanSessionId;
  consentGrantId: ConsentGrantId;
  consentGrantVersion: number;
  modality: ConsentModality;
  status: GenerationJobStatus;
  createdAt: Date;
  completedAt?: Date;
  resultUrl?: string;
  error?: string;
};

export type ProviderKind = "gmi" | "elevenlabs" | "heygen" | "openai" | "azure";

export type GenerationRequest = {
  jobId: string;
  creatorId: CreatorId;
  fanSessionId: FanSessionId;
  modality: ConsentModality;
  prompt: string;
  personaSnapshot: CreatorPersona;
  preferredProvider?: ProviderKind;
};
