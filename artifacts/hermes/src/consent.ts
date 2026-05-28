// Step 3 — Consent collection state machine for Hermes.
// In-memory session map keyed by Telegram user ID.
// Slice 1: sessions not persisted across restarts.
// TODO Slice 2: move to Redis for multi-replica support.

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

interface ConsentSession {
  creatorId: string;
  state: 'collecting' | 'confirming';
  currentIndex: number;
  answers: ConsentAnswers;
}

// Keyed by Telegram user ID
const sessions = new Map<number, ConsentSession>();

export function startConsentSession(tgUserId: number, creatorId: string): void {
  sessions.set(tgUserId, {
    creatorId,
    state: 'collecting',
    currentIndex: 0,
    answers: {},
  });
}

export function getConsentSession(tgUserId: number): ConsentSession | undefined {
  return sessions.get(tgUserId);
}

export function clearConsentSession(tgUserId: number): void {
  sessions.delete(tgUserId);
}

export function buildIntro(): string {
  return (
    'Now for the important part — your consent.\n' +
    "I need your explicit permission for each type of AI model.\n" +
    "You choose exactly what you're comfortable with.\n" +
    'You can change these later at any time.\n\n' +
    'Take your time.'
  );
}

export function buildCurrentPrompt(session: ConsentSession): string {
  const item = CONSENT_ITEMS[session.currentIndex];
  return `${item.emoji} ${item.label}\n${item.prompt}`;
}

export function buildConfirmCheck(item: ConsentItem, granted: boolean): string {
  const icon = granted ? '✅' : '❌';
  return `${icon} ${item.label} — ${granted ? 'granted' : 'not granted'}.`;
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
    '',
    'Reply CONFIRM to lock these in, or BACK to review any item.',
  ].join('\n');
}

export function allItemsAnswered(answers: ConsentAnswers): boolean {
  return CONSENT_ITEMS.every((item) => item.grantType in answers);
}

export function hasPersonaTextGrant(answers: ConsentAnswers): boolean {
  return answers['persona_text'] === true;
}

// SHA-256 of Telegram user ID used as ip_hash proxy for telegram channel.
// Telegram does not expose the creator's real IP to the bot.
export function telegramIpHash(tgUserId: number): string {
  return crypto.createHash('sha256').update(String(tgUserId)).digest('hex');
}

// Process a YES/NO/CONFIRM/BACK message from the creator during their consent session.
// Returns the reply text, or null if the input was unrecognised.
// Mutates session state in place.
export function processConsentMessage(
  session: ConsentSession,
  tgUserId: number,
  text: string,
): string | null {
  const upper = text.trim().toUpperCase();

  // ── Confirming state ──────────────────────────────────────────────────────
  if (session.state === 'confirming') {
    if (upper === 'CONFIRM') {
      return '__CONFIRM__';
    }
    if (upper === 'BACK') {
      session.state = 'collecting';
      session.currentIndex = 0;
      session.answers = {};
      return buildCurrentPrompt(session);
    }
    return 'Reply CONFIRM to lock in your choices, or BACK to review any item.';
  }

  // ── Collecting state ──────────────────────────────────────────────────────
  if (upper !== 'YES' && upper !== 'NO') return null;

  const granted = upper === 'YES';
  const item = CONSENT_ITEMS[session.currentIndex];

  // Re-ask state: persona_text was withheld (false), waiting for YES/NO
  if (item.grantType === 'persona_text' && session.answers['persona_text'] === false) {
    if (!granted) {
      // Creator still declines — offer to pause
      clearConsentSession(tgUserId);
      return (
        "No problem — your account is saved. When you're ready, send /consent to continue."
      );
    }
    // Grant persona_text and continue
    session.answers['persona_text'] = true;
    session.currentIndex = 1;
    return '✅ PERSONA / TEXT TWIN — granted.\n\n—\n\n' + buildCurrentPrompt(session);
  }

  // Normal item answer
  session.answers[item.grantType] = granted;

  // Hard block: persona_text withheld for the first time
  if (item.grantType === 'persona_text' && !granted) {
    return (
      'Your AI twin needs the Persona / Text permission to work.\n' +
      "Without it, I can't create a twin for you.\n\n" +
      'Want to grant it? Or would you like to pause for now?'
    );
  }

  const checkLine = buildConfirmCheck(item, granted);
  session.currentIndex += 1;

  if (session.currentIndex >= CONSENT_ITEMS.length) {
    session.state = 'confirming';
    return checkLine + '\n\n—\n\n' + buildSummary(session.answers);
  }

  return checkLine + '\n\n—\n\n' + buildCurrentPrompt(session);
}

// Write consent_grants rows, transition assets, update onboarding status on CONFIRM.
export async function commitConsent(
  creatorId: string,
  answers: ConsentAnswers,
  ipHash: string,
): Promise<void> {
  // Insert one row per consent item into consent_grants via Drizzle (D-14: retentionCategory='operational')
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

  if (hasPersonaTextGrant(answers)) {
    // PHASE-1 STUB: creator_assets write deferred to Phase 2 — table not in current Drizzle schema
    console.log('[hermes] STUB: creator_assets write deferred to Phase 2 — out of Phase 1 schema scope');
  }

  // PHASE-1 STUB: creator_onboarding write deferred to Phase 2 — table not in current Drizzle schema
  console.log('[hermes] STUB: creator_onboarding write deferred to Phase 2 — out of Phase 1 schema scope');

  // Slice 1 stub: real signal wired when Twin endpoint ships (OF-92 TODO)
  console.log(
    `[consent] twin production signal (stub) creator_id=${creatorId} persona_text_granted=${hasPersonaTextGrant(answers)}`,
  );
}
