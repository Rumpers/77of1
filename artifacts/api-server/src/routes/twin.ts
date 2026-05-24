import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const STUB_RESPONSES: Record<string, string[]> = {
  en: [
    "Thanks for reaching out! I'd love to connect with you more. What would you like to know about me?",
    "That's a great question! I'm always excited to chat with fans. You're amazing for being here!",
    "Absolutely! My fans mean everything to me. Let's keep this conversation going — subscribe for unlimited chats!",
  ],
  ja: [
    "ありがとう！もっと繋がりたいです。何か知りたいことはありますか？",
    "いい質問ですね！ファンの皆さんと話すのが大好きです。ここに来てくれてありがとう！",
    "もちろん！ファンの皆さんは私の全てです。もっと話し続けましょう — 無制限チャットにはサブスクをどうぞ！",
  ],
  "zh-TW": [
    "謝謝你聯絡我！很高興認識你。你想了解我什麼呢？",
    "好問題！我很喜歡和粉絲聊天。謝謝你在這裡！",
    "當然！粉絲對我來說意味著一切。訂閱後可以無限聊天喔！",
  ],
};

const DISCLOSURE_FOOTER: Record<string, string> = {
  en: "AI twin",
  ja: "AIツイン",
  "zh-TW": "AI分身",
};

// POST /api/twin/chat
// Body: { message: string, handle: string, locale: string }
// Returns: { text: string, disclosure_footer: string }
// No auth required — anonymous fans can chat (trial up to 3)
router.post("/twin/chat", (req: Request, res: Response) => {
  const { message, handle, locale } = req.body as {
    message?: string;
    handle?: string;
    locale?: string;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const safeLocale = locale && STUB_RESPONSES[locale] ? locale : "en";
  const responses = STUB_RESPONSES[safeLocale];
  const text = responses[Math.floor(Math.random() * responses.length)];

  const disclosureLabel = DISCLOSURE_FOOTER[safeLocale] ?? "AI twin";
  const safeHandle = handle ? String(handle).replace(/[^a-zA-Z0-9_]/g, "") : "creator";
  const disclosure_footer = `${disclosureLabel} · @${safeHandle}_ai`;

  res.json({ text, disclosure_footer });
});

export default router;
