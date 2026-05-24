// Unit tests for ConsentStore — mocks Supabase to avoid DB dependency.
import { ConsentStore } from './consent-store.js';
import type { ConsentCheckResult } from './types.js';

type SupabaseMockRow = {
  id: string;
  consent_grant_version: number;
  revoked_at: string | null;
} | null;

function makeMockSupabase(row: SupabaseMockRow, error: { message: string } | null = null) {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error }),
  };
  return chain as unknown as import('@supabase/supabase-js').SupabaseClient;
}

async function run() {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`);
      failed++;
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('\nConsentStore.checkConsent');

  await test('returns granted when active grant exists', async () => {
    const store = new ConsentStore(makeMockSupabase({
      id: 'grant-1',
      consent_grant_version: 3,
      revoked_at: null,
    }));
    const result = await store.checkConsent('creator-1', 'persona_text');
    assert(result.status === 'granted', `expected granted, got ${result.status}`);
    assert((result as Extract<ConsentCheckResult, { status: 'granted' }>).grantId === 'grant-1', 'grantId mismatch');
    assert((result as Extract<ConsentCheckResult, { status: 'granted' }>).consentGrantVersion === 3, 'version mismatch');
  });

  await test('returns denied when no grant row exists', async () => {
    const store = new ConsentStore(makeMockSupabase(null));
    const result = await store.checkConsent('creator-2', 'persona_text');
    assert(result.status === 'denied', `expected denied, got ${result.status}`);
    assert('reason' in result && result.reason === 'no_grant', 'reason mismatch');
  });

  await test('returns revoked when revoked_at is set', async () => {
    const store = new ConsentStore(makeMockSupabase({
      id: 'grant-3',
      consent_grant_version: 1,
      revoked_at: new Date().toISOString(),
    }));
    const result = await store.checkConsent('creator-3', 'persona_text');
    assert(result.status === 'revoked', `expected revoked, got ${result.status}`);
  });

  await test('returns denied on DB error', async () => {
    const store = new ConsentStore(makeMockSupabase(null, { message: 'connection refused' }));
    const result = await store.checkConsent('creator-4', 'persona_text');
    assert(result.status === 'denied', `expected denied, got ${result.status}`);
    assert('reason' in result && result.reason.includes('db_error'), 'reason should indicate db_error');
  });

  await test('checkedAt is a valid ISO 8601 timestamp', async () => {
    const store = new ConsentStore(makeMockSupabase({
      id: 'grant-5',
      consent_grant_version: 2,
      revoked_at: null,
    }));
    const result = await store.checkConsent('creator-5', 'persona_text');
    const ts = new Date(result.checkedAt);
    assert(!isNaN(ts.getTime()), `checkedAt is not a valid date: ${result.checkedAt}`);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
