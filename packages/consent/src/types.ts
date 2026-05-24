export type ConsentGrantType =
  | 'persona_text'
  | 'voice'
  | 'image'
  | 'talking_video'
  | 'fullbody_video'
  | 'social_oauth';

export type ConsentCheckResult =
  | {
      status: 'granted';
      grantId: string;
      consentGrantVersion: number;
      checkedAt: string; // ISO 8601
    }
  | {
      status: 'denied' | 'revoked';
      reason: string;
      checkedAt: string; // ISO 8601
    };
