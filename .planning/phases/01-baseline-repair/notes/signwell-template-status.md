# SignWell Template Status

**KYC-02 / D-07 — Voice Synthesis Authorization section**

**Status:** Deferred — no SignWell account provisioned yet

**Date recorded:** 2026-05-28

**Background:**
Plan 01-02 Task 4 requires the SignWell document template (referenced by
`SIGNWELL_TEMPLATE_ID` env var) to include a `VOICE SYNTHESIS AUTHORIZATION`
section covering:

- Scope: non-exclusive, revocable license for voice synthesis
- Duration: term of Service Agreement, terminable on written withdrawal via `/revoke`
- Revocability: Lala bot `/revoke` command, 48h deletion SLA
- Scope limitation: no explicit/adult/intimate content

**Deferred because:**
The SignWell account has not been provisioned for this project yet.
The `initiateSignwellSigning()` function in `lib/kyc.ts` is implemented and
reads from `SIGNWELL_API_KEY` + `SIGNWELL_TEMPLATE_ID`. When those env vars are
set in Replit, the signing flow will work end-to-end.

**Action required before first live creator:**
1. Create SignWell account at https://app.signwell.com
2. Create a document template for the Personality Rights Agreement
3. Add the `VOICE SYNTHESIS AUTHORIZATION` section per the body documented in
   `.planning/phases/01-baseline-repair/01-RESEARCH.md` "KYC Agreement Template (KYC-02)"
4. Copy the template ID into the Replit `SIGNWELL_TEMPLATE_ID` env var
5. Copy the API key into the Replit `SIGNWELL_API_KEY` env var
6. Update this file with the template version ID and mark `Status: Complete`

**Tracked as:** KYC-02 / D-07 compliance gap — must resolve before creator #1 onboards
