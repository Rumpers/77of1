// Consent grant catalogue, audit-log writer, and helpers for Hermes.
//
// Plan 02-07 (D-02 carried-over from Phase 1) deleted the in-memory `Map<>`
// session state machine that previously lived here. The multi-turn YES/NO/CONFIRM
// flow now lives in artifacts/hermes/src/scenes/consent.scene.ts (Telegraf
// WizardScene backed by @telegraf/session/pg). This file keeps only the
// stateless pieces that the scene + commitConsent path need.

import crypto from 'crypto';
import { db } from "@workspace/db";
import { consentGrantsTable } from "@workspace/db";

export const CONSENT_VERSION = 'v1.0';

export type ConsentGrantType =
  | 'persona_text'
  | 'voice'
  | 'image'
  | 'talking_video'
  | 'fullbody_video';

// Type alias matching consentGrantModalityEnum literal values from @workspace/db schema
type ConsentGrantModality =
  | 'persona_text'
  | 'voice'
  | 'image'
  | 'talking_video'
  | 'fullbody_video';

interface ConsentItem {
  grantType: ConsentGrantType;
  emoji: string;
  label: string;
  prompt: string;
  required: boolean;
}

// CEO-approved copy from OF-88 / §25.4
export const CONSENT_ITEMS: ConsentItem[] = [
  {
    grantType: 'persona_text',
    emoji: '🧠',
    label: 'PERSONA / TEXT TWIN',
    prompt:
      "I'll train an AI on your captions, messages, and the responses you just gave me — so your twin talks like you.\n\n(This is required for your twin to work.)\n\nGrant permission? Reply YES or NO",
    required: true,
  },
  {
    grantType: 'voice',
    emoji: '🎙',
    label: 'VOICE MODEL',
    prompt:
      "I'll clone your voice from your talking videos so your twin can send voice notes in your voice.\n\n(Optional — your twin works without it.)\n\nGrant permission? YES or NO",
    required: false,
  },
  {
    grantType: 'image',
    emoji: '📸',
    label: 'IMAGE MODEL',
    prompt:
      "I'll generate still images from your photos.\n\n(Optional.)\n\nGrant permission? YES or NO",
    required: false,
  },
  {
    grantType: 'talking_video',
    emoji: '📹',
    label: 'TALKING VIDEO (AVATAR)',
    prompt:
      "I'll create a video avatar that lip-syncs to your twin's messages. Uses your face and voice together.\n\n(Optional.)\n\nGrant permission? YES or NO",
    required: false,
  },
  {
    grantType: 'fullbody_video',
    emoji: '🕺',
    label: 'FULL-BODY / MOTION VIDEO',
    prompt:
      "I'll generate video of your body in motion. This is the highest tier — only for creators fully comfortable with video generation.\n\n(Optional.)\n\nGrant permission? YES or NO",
    required: false,
  },
];

export type ConsentAnswers = Partial<Record<ConsentGrantType, boolean>>;

export function buildIntro(): string {
  return (
    'Now for the important part — your consent.\n' +
    "I need your explicit permission for each type of AI model.\n" +
    "You choose exactly what you're comfortable with.\n" +
    'You can change these later at any time.\n\n' +
    'Take your time.'
  );
}

export function buildSummary(answers: ConsentAnswers): string {
  const lines = CONSENT_ITEMS.map((item) => {
    const granted = answers[item.grantType];
    return `${granted ? '✅' : '❌'} ${item.emoji} ${item.label} — ${granted ? 'granted' : 'not granted'}`;
  });
  return [
    "Here's a summary of your consent choices:",
    '',
    ...lines,
    '',
    'You can change any of these anytime via Hermes or your dashboard.',
  ].join('\n');
}

export function hasPersonaTextGrant(answers: ConsentAnswers): boolean {
  return answers['persona_text'] === true;
}

// SHA-256 of Telegram user ID used as ip_hash proxy for telegram channel.
// Telegram does not expose the creator's real IP to the bot.
export function telegramIpHash(tgUserId: number): string {
  return crypto.createHash('sha256').update(String(tgUserId)).digest('hex');
}

// Write consent_grants rows on confirm. Same audit-writing semantics as Phase 1.
export async function commitConsent(
  creatorId: string,
  answers: ConsentAnswers,
  ipHash: string,
): Promise<void> {
  await db.insert(consentGrantsTable).values(
    CONSENT_ITEMS.map((item) => ({
      creatorId,
      modality: item.grantType as ConsentGrantModality,
      granted: answers[item.grantType] ?? false,
      grantedAt: new Date(),
      consentVersion: CONSENT_VERSION,
      channel: 'telegram',
      ipHash,
      retentionCategory: "operational" as const,
    }))
  );

  // Slice 1 stub: real signal wired when Twin endpoint ships (OF-92 TODO)
  console.log(
    `[consent] twin production signal (stub) creator_id=${creatorId} persona_text_granted=${hasPersonaTextGrant(answers)}`,
  );
}
