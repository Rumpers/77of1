import crypto from 'crypto'
import { describe, it, expect } from 'vitest'
import { verifyIngestSignature } from '@/lib/refund-ingest'

// ─── HMAC-SHA256 verification tests ──────────────────────────────────────────
// Validates the HMAC signature logic for POST /api/webhooks/refund-email-ingest.
// Tests run against the extracted pure lib function (no DB imports needed).

const SECRET = 'test-secret-for-unit-tests'

function makeSignature(body: string, secret: string = SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

describe('verifyIngestSignature — HMAC-SHA256', () => {
  const body = JSON.stringify({
    sender: 'fan@example.com',
    subject: 'Refund',
    body: 'Please refund',
  })

  it('accepts a valid sha256= prefixed signature', () => {
    expect(verifyIngestSignature(body, makeSignature(body), SECRET)).toBe(true)
  })

  it('accepts a valid signature without sha256= prefix', () => {
    const raw = crypto.createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')
    expect(verifyIngestSignature(body, raw, SECRET)).toBe(true)
  })

  it('rejects a signature computed with the wrong secret', () => {
    expect(verifyIngestSignature(body, makeSignature(body, 'wrong-secret'), SECRET)).toBe(false)
  })

  it('rejects a tampered body', () => {
    const sig = makeSignature(body)
    const tampered = body.replace('fan@example.com', 'attacker@example.com')
    expect(verifyIngestSignature(tampered, sig, SECRET)).toBe(false)
  })

  it('rejects an empty signature', () => {
    expect(verifyIngestSignature(body, '', SECRET)).toBe(false)
  })

  it('rejects a truncated signature (length mismatch)', () => {
    const partial = makeSignature(body).slice(0, 20)
    expect(verifyIngestSignature(body, partial, SECRET)).toBe(false)
  })

  it('rejects a random 64-hex-char string (correct length, wrong bytes)', () => {
    const fake = 'sha256=' + 'a'.repeat(64)
    expect(verifyIngestSignature(body, fake, SECRET)).toBe(false)
  })

  it('is deterministic: same inputs always return true', () => {
    const sig = makeSignature(body)
    expect(verifyIngestSignature(body, sig, SECRET)).toBe(true)
    expect(verifyIngestSignature(body, sig, SECRET)).toBe(true)
  })
})
