// Fan page — IG/TikTok webview-safe (no OAuth popups, no payment redirects)
// Webview compatibility lens: magic link auth + Stripe Embedded only
export default function FanPage({
  params,
}: {
  params: { creatorSlug: string };
}) {
  return (
    <main>
      <h1>{params.creatorSlug}</h1>
      <p>Fan page — coming soon</p>
    </main>
  );
}
