/**
 * MonetizationCTA — inline pill at the end of an AI bubble pointing the fan
 * to the creator's monetization platform (Fanvue, Patreon, 17LIVE, etc.).
 *
 * Server-controlled trigger (D-02-10): api-server attaches
 * `monetization_pivot: true` to the response when (a) the persona text hits a
 * pivot phrase, or (b) the message counter mod 5 == 0. Client just renders.
 *
 * Visual (UI-SPEC "Monetization CTA placement"):
 *   - Inline pill at bubble end, on its own line
 *   - Brand-color background, white-on-brand text
 *   - 12px text, ~10px vertical / 14px horizontal padding, rounded-full
 *   - `→` glyph at end
 *
 * Behavior:
 *   - Click opens `monetizationUrl` in new tab (noopener noreferrer)
 *   - ARIA label includes platform name so screen readers know the destination
 *   - No tracking pixel for v1 (ATTR-01/02/03 are v2)
 */

export interface MonetizationCTAProps {
  platformName: string;
  monetizationUrl: string;
  locale: string;
  /** Localised CTA template — e.g. `Want more? Find me on {platform_name} →` */
  ctaTemplate: string;
  /** Brand-color hex for pill background; defaults to violet brand var */
  brandColor?: string;
}

export function MonetizationCTA({
  platformName,
  monetizationUrl,
  locale,
  ctaTemplate,
  brandColor,
}: MonetizationCTAProps) {
  const text = ctaTemplate.replace(/\{platform_name\}/g, platformName);
  return (
    <a
      href={monetizationUrl}
      target="_blank"
      rel="noopener noreferrer"
      lang={locale}
      aria-label={`Open ${platformName} in new tab`}
      className="inline-flex items-center gap-1 mt-2 px-3.5 py-2 text-[0.75rem] font-medium text-white rounded-full no-underline"
      style={{ background: brandColor ?? "var(--brand, #7c3aed)" }}
    >
      {text}
    </a>
  );
}
