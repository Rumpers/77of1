import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorId } from '@7of1/types';
import type { ConsentCheckResult, ConsentGrantType } from './types.js';

// Consent is NEVER cached — every call hits the DB.
// ADR-011 Decision 2: stale grant versions return denied; revocation propagates within 60s.
export class ConsentStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async checkConsent(
    creatorId: CreatorId,
    grantType: ConsentGrantType,
  ): Promise<ConsentCheckResult> {
    const checkedAt = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('consent_grants')
      .select('id, consent_grant_version, revoked_at')
      .eq('creator_id', creatorId)
      .eq('grant_type', grantType)
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { status: 'denied', reason: `db_error: ${error.message}`, checkedAt };
    }
    if (!data) {
      return { status: 'denied', reason: 'no_grant', checkedAt };
    }
    if (data.revoked_at !== null) {
      return { status: 'revoked', reason: 'grant_revoked', checkedAt };
    }

    return {
      status: 'granted',
      grantId: data.id as string,
      consentGrantVersion: data.consent_grant_version as number,
      checkedAt,
    };
  }
}
