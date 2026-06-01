import "./instrument"; // must be first — Sentry captures load-time errors
import '@fontsource-variable/inter';                  // self-hosted — replaces Google Fonts CDN
import '@fontsource-variable/noto-sans-jp';           // CJK JA — unicode-range subsetting loads lazily
import '@fontsource-variable/bricolage-grotesque';    // marketing display — Luminous Infrastructure hero/h1
import '@fontsource-variable/geist';                  // marketing body — infrastructure credibility tone
import '@fontsource-variable/noto-sans-tc';           // CJK ZH-TW — Taiwan fan coverage
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
