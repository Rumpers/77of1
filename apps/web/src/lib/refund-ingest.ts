import crypto from 'crypto'

// HMAC-SHA256 signature verification for the refund email ingest webhook.
// Signature header format: "sha256=<hex>" or raw "<hex>" (both accepted).
// Uses timing-safe comparison to prevent timing attacks.
export function verifyIngestSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualHex = signature.startsWith('sha256=') ? signature.slice(7) : signature
  let actualBuf: Buffer
  try {
    actualBuf = Buffer.from(actualHex, 'hex')
  } catch {
    return false
  }
  if (expectedBuf.length !== actualBuf.length || actualBuf.length === 0) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

export function getIngestSecret(): string {
  const s = process.env.REFUND_EMAIL_INGEST_SECRET
  if (!s) throw new Error('REFUND_EMAIL_INGEST_SECRET is not set')
  return s
}
