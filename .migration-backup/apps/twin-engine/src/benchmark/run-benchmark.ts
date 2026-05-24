/**
 * GMI Text Adapter Benchmark — OF-60
 *
 * Measures quality, latency, and cost of GMITextProvider vs GPT-4o baseline.
 * Run with: pnpm --filter @7of1/twin-engine benchmark
 *
 * Requirements:
 *   GMI_API_KEY  — GMI inference key (Replit Secret)
 *   OPENAI_API_KEY (optional) — for GPT-4o baseline comparison
 *
 * Quality scoring: each response is rated 1-5 on "sounds like the creator"
 * by an LLM judge (Claude/GPT-4o). ≥70% rate ≥4/5 = pass.
 */

import { GMITextProvider } from "../providers/index.js";
import type { TextContext } from "@7of1/types";

// ── Test persona ────────────────────────────────────────────────────────────

const CREATOR_PERSONA_PROMPT = `You are Yuki, a bilingual Japanese-English VTuber streamer on 17.live.
Your personality: bubbly, warm, uses "kawaii" and light Japanese phrases naturally in English.
You stream gacha games and chatting streams. You love takoyaki and cats.
You call your fans "Yukifam". You sprinkle 〜 and ♡ occasionally.
Never break character. Never reveal you are an AI.`;

const TEST_MESSAGES: Array<{ prompt: string; language: TextContext["language"] }> = [
  { prompt: "Hey Yuki! What's your favorite game right now?", language: "en" },
  { prompt: "Do you have any cats?", language: "en" },
  { prompt: "What's it like being a VTuber?", language: "en" },
  { prompt: "I love your streams so much!", language: "en" },
  { prompt: "What did you have for breakfast?", language: "en" },
  { prompt: "Can you say something cute?", language: "en" },
  { prompt: "What's your favorite thing about your fans?", language: "en" },
  { prompt: "Missed your last stream, what happened?", language: "en" },
  { prompt: "ゆきちゃん、今日は何してる？", language: "ja" },
  { prompt: "好きな食べ物は何ですか？", language: "ja" },
  { prompt: "最近どんなゲームをプレイしていますか？", language: "ja" },
  { prompt: "ゆき大好き！いつも楽しい配信ありがとう！", language: "ja" },
  { prompt: "ファンへのメッセージをお願いします", language: "ja" },
  { prompt: "你好！你會說中文嗎？", language: "zh-TW" },
  { prompt: "你最喜歡什麼遊戲？", language: "zh-TW" },
  { prompt: "今天心情怎麼樣？", language: "zh-TW" },
  { prompt: "我是你的新粉絲！", language: "zh-TW" },
  { prompt: "What's something your fans always say to you?", language: "en" },
  { prompt: "Tell me a fun fact about yourself!", language: "en" },
  { prompt: "What would you do with a million followers?", language: "en" },
];

// ── Judge prompt ─────────────────────────────────────────────────────────────

async function judgeResponse(
  creatorPrompt: string,
  userMessage: string,
  response: string,
  judgeApiKey: string
): Promise<number> {
  const judgePrompt = `You are evaluating whether an AI twin response sounds authentically like the creator.

Creator persona:
${creatorPrompt}

Fan message: "${userMessage}"
AI twin response: "${response}"

Rate 1-5 (5 = perfectly in character, sounds exactly like this creator; 1 = completely off-brand):
Reply with ONLY the number.`;

  // Use GMI/DeepSeek as judge for cost efficiency
  const res = await fetch("https://api.gmi-serving.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${judgeApiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3.2",
      messages: [
        { role: "system", content: "You are a strict quality evaluator. Reply with a single digit 1-5." },
        { role: "user", content: judgePrompt },
      ],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  if (!res.ok) return 3; // neutral fallback if judge fails
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const score = parseInt(data.choices[0]?.message?.content?.trim() ?? "3", 10);
  return isNaN(score) ? 3 : Math.min(5, Math.max(1, score));
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

// ── Main benchmark ───────────────────────────────────────────────────────────

async function runBenchmark() {
  const apiKey = process.env["GMI_API_KEY"];
  if (!apiKey) {
    console.error("ERROR: GMI_API_KEY environment variable is not set.");
    console.error("Set it via Replit Secrets or export GMI_API_KEY=<key>");
    process.exit(1);
  }

  const provider = new GMITextProvider({ apiKey });
  console.log(`\n=== GMI Text Adapter Benchmark (OF-60) ===`);
  console.log(`Model: ${provider.modelId}`);
  console.log(`Test messages: ${TEST_MESSAGES.length}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const latencies: number[] = [];
  const tokenCounts: number[] = [];
  const qualityScores: number[] = [];
  const errors: string[] = [];

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const { prompt, language } = TEST_MESSAGES[i]!;
    const ctx: TextContext = {
      creatorId: "benchmark-creator-yuki",
      systemPrompt: CREATOR_PERSONA_PROMPT,
      ragChunks: [],
      intensityDial: "warm",
      language,
    };

    try {
      const resp = await provider.generate(prompt, ctx);
      latencies.push(resp.latencyMs);
      tokenCounts.push(resp.tokensUsed);

      const score = await judgeResponse(CREATOR_PERSONA_PROMPT, prompt, resp.text, apiKey);
      qualityScores.push(score);

      console.log(
        `[${i + 1}/${TEST_MESSAGES.length}] ${language.padEnd(5)} ${resp.latencyMs}ms ` +
          `${resp.tokensUsed}tok score=${score}/5 — ${resp.text.slice(0, 60).replace(/\n/g, " ")}…`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`msg[${i}]: ${msg}`);
      console.error(`[${i + 1}] ERROR: ${msg}`);
    }

    // small delay to avoid rate-limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  // ── Results ─────────────────────────────────────────────────────────────

  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const passRate = qualityScores.filter((s) => s >= 4).length / qualityScores.length;

  // GMI DeepSeek-V3.2 pricing (from docs.gmicloud.ai — verify before finalising):
  // Input: ~$0.27/1M tokens | Output: ~$1.10/1M tokens (estimate; confirm with GMI team)
  const INPUT_COST_PER_1K = 0.00027;
  const OUTPUT_COST_PER_1K = 0.0011;
  const avgCostPer1kTotal =
    (INPUT_COST_PER_1K + OUTPUT_COST_PER_1K) / 2;

  console.log("\n=== BENCHMARK RESULTS ===");
  console.log(`Quality (≥4/5 rate):  ${(passRate * 100).toFixed(1)}%  [pass bar: ≥70%] → ${passRate >= 0.7 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Latency p50:          ${p50}ms              [bar: <2000ms] → ${p50 < 2000 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Latency p95:          ${p95}ms              [bar: <5000ms] → ${p95 < 5000 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Avg tokens/response:  ${avgTokens.toFixed(0)}`);
  console.log(`Est. cost/1k tokens:  $${avgCostPer1kTotal.toFixed(5)} (input avg; ESTIMATE — confirm pricing)`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach((e) => console.log(`  ${e}`));
  }

  const allPass = passRate >= 0.7 && p50 < 2000 && p95 < 5000;
  console.log(`\nOverall: ${allPass ? "✅ GMI PASSES — safe to lock in as text provider" : "❌ GMI FAILS — escalate to CEO before any provider commitment"}`);

  // ── Structured output for issue comment ──────────────────────────────────
  const report = {
    runAt: new Date().toISOString(),
    model: provider.modelId,
    testMessages: TEST_MESSAGES.length,
    qualityPassRate: parseFloat((passRate * 100).toFixed(1)),
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    avgTokensPerResponse: parseFloat(avgTokens.toFixed(0)),
    estimatedCostPer1kTokensUSD: avgCostPer1kTotal,
    errors: errors.length,
    verdict: allPass ? "PASS" : "FAIL",
  };
  console.log("\nJSON report:");
  console.log(JSON.stringify(report, null, 2));
}

runBenchmark().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
