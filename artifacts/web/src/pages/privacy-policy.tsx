// Privacy Policy page — required for Meta App Review (instagram_business_manage_messages)
// URL: /privacy-policy  (locale-free, so Meta reviewers can link directly)

const BRAND = "#7C3AED";
const LAST_UPDATED = "2026-05-27";
const CONTACT_EMAIL = "privacy@7of1.com";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "2rem" }}>
    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: BRAND, marginBottom: "0.75rem" }}>{title}</h2>
    {children}
  </section>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ marginBottom: "0.75rem", lineHeight: 1.7, color: "#374151" }}>{children}</p>
);

const Ul = ({ items }: { items: string[] }) => (
  <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
    {items.map((item, i) => (
      <li key={i} style={{ marginBottom: "0.4rem", lineHeight: 1.7, color: "#374151" }}>{item}</li>
    ))}
  </ul>
);

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "#fff", borderRadius: "12px", padding: "2.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem", borderBottom: "2px solid #EDE9FE", paddingBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, color: BRAND }}>7of1</span>
            <span style={{ fontSize: "1.25rem", color: "#6B7280" }}>Privacy Policy</span>
          </div>
          <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Who We Are">
          <P>
            7of1 (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates an AI-powered creator engagement platform that enables live-streaming creators to maintain a presence with their fans around the clock via AI-generated responses that reflect the creator&rsquo;s voice and persona.
          </P>
          <P>
            Our platform is used primarily by creators on 17 Live and their fans across multiple messaging channels including Instagram Direct Messages.
          </P>
        </Section>

        <Section title="2. What Data We Collect">
          <P>We collect the following categories of data when you interact with our platform:</P>
          <Ul items={[
            "Instagram Direct Messages sent to a creator's account where the creator has enabled 7of1 (message text, sender user ID, timestamp, message ID)",
            "Instagram comments on creator posts where the creator has enabled comment monitoring (comment text, commenter user ID, post ID, timestamp)",
            "Creator account identifiers (Instagram user ID, account type, username) required to manage the messaging integration",
            "Fan interaction metadata (message thread IDs, conversation history needed for context-aware AI responses)",
            "Payment information processed by our payment provider (Stripe) — we do not store full card details",
            "Account registration data (email address, display name) for creator accounts on our platform",
          ]} />
        </Section>

        <Section title="3. How We Use Your Data">
          <P>We use collected data for the following purposes:</P>
          <Ul items={[
            "Generating AI responses on behalf of the creator — message content is passed to our AI inference service to produce a contextually appropriate reply in the creator's voice",
            "Maintaining conversation context so AI replies are coherent across a message thread",
            "Creator analytics — aggregated, anonymised engagement metrics shown to the creator in their dashboard",
            "Billing and credits management — tracking fan credit usage for interactions",
            "Compliance and safety — reviewing flagged content and responding to platform policy violations",
            "Service improvement — training improvements to response quality (only with explicit creator consent and only using anonymised data)",
          ]} />
          <P>We do <strong>not</strong> use your messages to train AI models without explicit consent, sell your data to third parties, or use message content for advertising purposes.</P>
        </Section>

        <Section title="4. Legal Basis for Processing (GDPR)">
          <P>For users in the European Economic Area, our legal bases for processing are:</P>
          <Ul items={[
            "Contract performance — processing necessary to deliver the AI messaging service the creator has subscribed to",
            "Legitimate interests — fraud prevention, security monitoring, and platform integrity",
            "Consent — AI training on personal data (opt-in only)",
          ]} />
        </Section>

        <Section title="5. Data Sharing">
          <P>We share data only with the following parties:</P>
          <Ul items={[
            "AI inference providers (Anthropic, Google) — message text is sent for AI response generation under strict data processing agreements; these providers do not retain your data for their own training",
            "Stripe — payment data is handled exclusively by Stripe under their own privacy policy",
            "Infrastructure providers (Replit) — encrypted at rest and in transit; no access to content",
            "Legal authorities — only when legally required and after review",
          ]} />
          <P>We do not sell personal data to any third party.</P>
        </Section>

        <Section title="6. Data Retention">
          <Ul items={[
            "Message content: retained for 90 days to support conversation context, then deleted",
            "Aggregated analytics: retained indefinitely in anonymised form",
            "Creator account data: retained for the duration of the account plus 30 days after deletion",
            "Payment records: retained for 7 years as required by applicable tax law",
          ]} />
        </Section>

        <Section title="7. Your Rights">
          <P>Depending on your jurisdiction, you have the right to:</P>
          <Ul items={[
            "Access — request a copy of the personal data we hold about you",
            "Rectification — request correction of inaccurate data",
            "Erasure — request deletion of your personal data ('right to be forgotten')",
            "Portability — receive your data in a machine-readable format",
            "Objection — object to certain types of processing",
            "Restriction — request we restrict processing while a dispute is resolved",
          ]} />
          <P>
            To exercise your rights, use our{" "}
            <a href="/en/account/data-request" style={{ color: BRAND }}>Data Request Portal</a>{" "}
            or email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: BRAND }}>{CONTACT_EMAIL}</a>.
            We will respond within 30 days.
          </P>
        </Section>

        <Section title="8. Instagram Data Use">
          <P>
            When a creator connects their Instagram account to 7of1, we access their Direct Messages and comments via the Instagram Messaging API. Specifically:
          </P>
          <Ul items={[
            "We read incoming Direct Messages so the AI twin can generate a reply on the creator's behalf",
            "We send replies via the API on behalf of the creator's account — the creator can review, edit, or disable responses at any time via their dashboard",
            "We access comment data to surface fan engagement to the creator (read-only; we do not post comments without explicit creator action)",
            "Message content is processed transiently for AI inference and stored for 90 days for context continuity, then deleted",
            "We do not scrape Instagram for any data beyond what the creator explicitly grants us access to via OAuth",
          ]} />
          <P>
            Creators can revoke our Instagram access at any time via Instagram Settings &rarr; Apps and Websites, or by disconnecting from their 7of1 dashboard. Upon revocation, we delete all stored messages within 72 hours.
          </P>
        </Section>

        <Section title="9. Security">
          <P>
            We use industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest, role-based access controls, and regular security audits. Message content is accessed only by the AI inference pipeline and is never exposed to 7of1 staff without a legitimate support or legal reason.
          </P>
        </Section>

        <Section title="10. Children">
          <P>Our platform is not directed to persons under the age of 18. If you believe we have collected data from a minor, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: BRAND }}>{CONTACT_EMAIL}</a> and we will delete it promptly.</P>
        </Section>

        <Section title="11. Changes to This Policy">
          <P>We may update this Privacy Policy periodically. We will notify creators of material changes by email and by posting a notice in the creator dashboard at least 14 days before the changes take effect.</P>
        </Section>

        <Section title="12. Contact Us">
          <P>
            7of1<br />
            Privacy enquiries: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: BRAND }}>{CONTACT_EMAIL}</a><br />
            Data deletion requests: <a href="/en/account/data-request" style={{ color: BRAND }}>Data Request Portal</a>
          </P>
        </Section>
      </div>
    </div>
  );
}
